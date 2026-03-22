import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import LightningFS from '@isomorphic-git/lightning-fs';
import { Subject, debounceTime } from 'rxjs';

const PROJECTS_STORAGE_KEY = 'pypad_projects_state';
const DEBOUNCE_MS = 500;
const DEFAULT_PROJECT_FILE = 'main.py';

interface StoredProjectsState {
  projects: string[];
  activeProjectName: string | null;
  activeFileByProject: Record<string, string>;
}

interface QueuedProjectSave {
  projectName: string;
  fileName: string;
  code: string;
}

export type ProjectModuleMap = Record<string, string>;

export interface ProjectFileEntry {
  fileName: string;
  code: string;
}

export interface ProjectSnapshot {
  projectName: string;
  fileName: string;
  files: string[];
  code: string;
}

function normalizeName(name: string): string {
  return name.trim();
}

function hasFsNameSeparators(name: string): boolean {
  return /[\\/]/.test(name);
}

function sortNames(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorCode(error: unknown): string | undefined {
  return isObject(error) && typeof error['code'] === 'string' ? error['code'] : undefined;
}

function toModuleName(fileName: string): string | null {
  const match = fileName.match(/^([A-Za-z_][A-Za-z0-9_]*)\.py$/);
  return match?.[1] ?? null;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = this.loadState();
  private readonly fs = new LightningFS();
  private readonly saveQueue = new Subject<QueuedProjectSave>();
  private currentFsProjectName: string | null = null;
  private queuedSave: QueuedProjectSave | null = null;

  readonly availableProjects = signal<string[]>(sortNames(this.state.projects));
  readonly activeProjectName = signal<string | null>(this.state.activeProjectName);
  readonly activeFileName = signal<string | null>(null);
  readonly projectFiles = signal<string[]>([]);
  readonly isProjectOpen = computed(() => this.activeProjectName() !== null);

  constructor() {
    this.saveQueue
      .pipe(debounceTime(DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((save) => void this.persistQueuedSave(save));
  }

  async restoreActiveProject(): Promise<ProjectSnapshot | null> {
    const activeProjectName = this.activeProjectName();
    if (!activeProjectName) return null;

    try {
      return await this.openProject(activeProjectName);
    } catch {
      await this.closeProject();
      return null;
    }
  }

  queueSaveActiveFile(code: string): void {
    const projectName = this.activeProjectName();
    const fileName = this.activeFileName();
    if (!projectName || !fileName) return;

    this.queuedSave = { projectName, fileName, code };
    this.saveQueue.next(this.queuedSave);
  }

  async flush(): Promise<void> {
    if (!this.queuedSave) return;

    const save = this.queuedSave;
    this.queuedSave = null;
    await this.persistQueuedSave(save);
  }

  async createProject(projectName: string, initialCode: string): Promise<ProjectSnapshot> {
    const normalizedName = this.validateProjectName(projectName);
    if (this.availableProjects().includes(normalizedName)) {
      throw new Error(`A project named "${normalizedName}" already exists.`);
    }

    await this.flush();

    const fs = this.useProject(normalizedName);
    await fs.writeFile(this.toFilePath(DEFAULT_PROJECT_FILE), initialCode, 'utf8');
    await fs.flush();

    const nextProjects = sortNames([...this.availableProjects(), normalizedName]);
    this.availableProjects.set(nextProjects);
    this.activeProjectName.set(normalizedName);
    this.projectFiles.set([DEFAULT_PROJECT_FILE]);
    this.activeFileName.set(DEFAULT_PROJECT_FILE);

    this.state.projects = nextProjects;
    this.state.activeProjectName = normalizedName;
    this.state.activeFileByProject[normalizedName] = DEFAULT_PROJECT_FILE;
    this.persistState();

    return {
      projectName: normalizedName,
      fileName: DEFAULT_PROJECT_FILE,
      files: [DEFAULT_PROJECT_FILE],
      code: initialCode,
    };
  }

  async openProject(projectName: string): Promise<ProjectSnapshot> {
    const normalizedName = this.validateKnownProject(projectName);
    await this.flush();

    const fs = this.useProject(normalizedName);
    let files = await this.readProjectFiles(fs);
    if (files.length === 0) {
      await fs.writeFile(this.toFilePath(DEFAULT_PROJECT_FILE), '', 'utf8');
      await fs.flush();
      files = [DEFAULT_PROJECT_FILE];
    }

    const rememberedFile = this.state.activeFileByProject[normalizedName];
    const activeFileName = files.includes(rememberedFile) ? rememberedFile : files[0];
    const code = await this.readFile(fs, activeFileName);

    this.activeProjectName.set(normalizedName);
    this.activeFileName.set(activeFileName);
    this.projectFiles.set(files);

    this.state.activeProjectName = normalizedName;
    this.state.activeFileByProject[normalizedName] = activeFileName;
    this.persistState();

    return {
      projectName: normalizedName,
      fileName: activeFileName,
      files,
      code,
    };
  }

  async closeProject(): Promise<void> {
    await this.flush();
    this.activeProjectName.set(null);
    this.activeFileName.set(null);
    this.projectFiles.set([]);
    this.state.activeProjectName = null;
    this.persistState();
  }

  async deleteActiveProject(): Promise<string> {
    const projectName = this.requireActiveProject();

    await this.flush();

    this.currentFsProjectName = null;
    this.fs.init(this.toFsName(projectName), { wipe: true });
    await this.fs.promises.stat('/');

    const nextProjects = this.availableProjects().filter((name) => name !== projectName);

    delete this.state.activeFileByProject[projectName];
    this.state.projects = nextProjects;
    this.state.activeProjectName = null;

    this.availableProjects.set(nextProjects);
    this.activeProjectName.set(null);
    this.activeFileName.set(null);
    this.projectFiles.set([]);
    this.currentFsProjectName = null;
    this.persistState();

    return projectName;
  }

  async createFile(fileName: string, code = ''): Promise<ProjectSnapshot> {
    const projectName = this.requireActiveProject();
    const normalizedFileName = this.validateFileName(fileName);
    const files = this.projectFiles();
    if (files.includes(normalizedFileName)) {
      throw new Error(`A file named "${normalizedFileName}" already exists in ${projectName}.`);
    }

    await this.flush();

    const fs = this.useProject(projectName);
    await fs.writeFile(this.toFilePath(normalizedFileName), code, 'utf8');
    await fs.flush();

    const nextFiles = sortNames([...files, normalizedFileName]);
    this.projectFiles.set(nextFiles);
    this.activeFileName.set(normalizedFileName);
    this.state.activeFileByProject[projectName] = normalizedFileName;
    this.persistState();

    return { projectName, fileName: normalizedFileName, files: nextFiles, code };
  }

  async openFile(fileName: string): Promise<ProjectSnapshot> {
    const projectName = this.requireActiveProject();
    const normalizedFileName = this.validateKnownFile(fileName);
    await this.flush();

    const fs = this.useProject(projectName);
    const code = await this.readFile(fs, normalizedFileName);
    const files = await this.readProjectFiles(fs);

    this.projectFiles.set(files);
    this.activeFileName.set(normalizedFileName);
    this.state.activeFileByProject[projectName] = normalizedFileName;
    this.persistState();

    return { projectName, fileName: normalizedFileName, files, code };
  }

  async readActiveProjectModules(): Promise<ProjectModuleMap> {
    const projectName = this.requireActiveProject();
    const fs = this.useProject(projectName);
    const files = await this.readProjectFiles(fs);
    const pythonFiles = files
      .map((fileName) => ({ fileName, moduleName: toModuleName(fileName) }))
      .filter((file): file is { fileName: string; moduleName: string } => file.moduleName !== null);

    const modules = await Promise.all(
      pythonFiles.map(async ({ fileName, moduleName }) => ({
        moduleName,
        code: await this.readFile(fs, fileName),
      })),
    );

    return modules.reduce<ProjectModuleMap>((acc, { moduleName, code }) => {
      acc[moduleName] = code;
      return acc;
    }, {});
  }

  async readActiveProjectFiles(): Promise<ProjectFileEntry[]> {
    const projectName = this.requireActiveProject();
    const fs = this.useProject(projectName);
    const files = await this.readProjectFiles(fs);

    return Promise.all(
      files.map(async (fileName) => ({
        fileName,
        code: await this.readFile(fs, fileName),
      })),
    );
  }

  async writeImportedFile(fileName: string, code: string): Promise<ProjectSnapshot> {
    const projectName = this.requireActiveProject();
    const normalizedFileName = this.validateFileName(fileName);

    await this.flush();

    const fs = this.useProject(projectName);
    await fs.writeFile(this.toFilePath(normalizedFileName), code, 'utf8');
    await fs.flush();

    const files = await this.readProjectFiles(fs);
    this.projectFiles.set(files);
    this.activeFileName.set(normalizedFileName);
    this.state.activeFileByProject[projectName] = normalizedFileName;
    this.persistState();

    return { projectName, fileName: normalizedFileName, files, code };
  }

  async renameFile(fileName: string, nextFileName: string): Promise<string> {
    const projectName = this.requireActiveProject();
    const currentFileName = this.validateKnownFile(fileName);
    const currentActiveFileName = this.requireActiveFile();
    const normalizedFileName = this.validateFileName(nextFileName);
    if (normalizedFileName === currentFileName) return currentFileName;
    if (this.projectFiles().includes(normalizedFileName)) {
      throw new Error(`A file named "${normalizedFileName}" already exists in ${projectName}.`);
    }

    await this.flush();

    const fs = this.useProject(projectName);
    await fs.rename(this.toFilePath(currentFileName), this.toFilePath(normalizedFileName));
    await fs.flush();

    const files = await this.readProjectFiles(fs);
    const nextActiveFileName =
      currentActiveFileName === currentFileName ? normalizedFileName : currentActiveFileName;

    this.projectFiles.set(files);
    this.activeFileName.set(nextActiveFileName);
    this.state.activeFileByProject[projectName] = nextActiveFileName;
    this.persistState();

    return normalizedFileName;
  }

  async renameActiveFile(nextFileName: string): Promise<string> {
    return this.renameFile(this.requireActiveFile(), nextFileName);
  }

  async deleteFile(fileName: string): Promise<ProjectSnapshot> {
    const projectName = this.requireActiveProject();
    const normalizedFileName = this.validateKnownFile(fileName);
    const currentActiveFileName = this.requireActiveFile();

    await this.flush();

    const fs = this.useProject(projectName);
    await fs.unlink(this.toFilePath(normalizedFileName));

    let files = await this.readProjectFiles(fs);
    if (files.length === 0) {
      await fs.writeFile(this.toFilePath(DEFAULT_PROJECT_FILE), '', 'utf8');
      await fs.flush();
      files = [DEFAULT_PROJECT_FILE];
    } else {
      await fs.flush();
    }

    const nextActiveFileName =
      currentActiveFileName === normalizedFileName
        ? files[0]
        : files.includes(currentActiveFileName)
          ? currentActiveFileName
          : files[0];

    const code = await this.readFile(fs, nextActiveFileName);

    this.projectFiles.set(files);
    this.activeFileName.set(nextActiveFileName);
    this.state.activeFileByProject[projectName] = nextActiveFileName;
    this.persistState();

    return {
      projectName,
      fileName: nextActiveFileName,
      files,
      code,
    };
  }

  async renameActiveProject(nextProjectName: string): Promise<string> {
    const currentProjectName = this.requireActiveProject();
    const normalizedProjectName = this.validateProjectName(nextProjectName);
    if (normalizedProjectName === currentProjectName) return currentProjectName;
    if (this.availableProjects().includes(normalizedProjectName)) {
      throw new Error(`A project named "${normalizedProjectName}" already exists.`);
    }

    await this.flush();

    const currentFs = this.useProject(currentProjectName);
    const files = await this.readProjectFiles(currentFs);
    const copiedFiles = await Promise.all(
      files.map(async (fileName) => ({
        fileName,
        code: await this.readFile(currentFs, fileName),
      })),
    );

    const nextFs = new LightningFS(this.toFsName(normalizedProjectName)).promises;
    for (const file of copiedFiles) {
      await nextFs.writeFile(this.toFilePath(file.fileName), file.code, 'utf8');
    }
    await nextFs.flush();

    const nextProjects = sortNames(
      this.availableProjects().map((projectName) =>
        projectName === currentProjectName ? normalizedProjectName : projectName,
      ),
    );
    const activeFileName = this.requireActiveFile();

    delete this.state.activeFileByProject[currentProjectName];
    this.state.activeFileByProject[normalizedProjectName] = activeFileName;
    this.state.projects = nextProjects;
    this.state.activeProjectName = normalizedProjectName;

    this.availableProjects.set(nextProjects);
    this.activeProjectName.set(normalizedProjectName);
    this.projectFiles.set(sortNames(copiedFiles.map((file) => file.fileName)));
    this.currentFsProjectName = null;
    this.useProject(normalizedProjectName);
    this.persistState();

    return normalizedProjectName;
  }

  private async persistQueuedSave(save: QueuedProjectSave): Promise<void> {
    if (this.activeProjectName() !== save.projectName || this.activeFileName() !== save.fileName) {
      return;
    }

    const fs = this.useProject(save.projectName);
    await fs.writeFile(this.toFilePath(save.fileName), save.code, 'utf8');
    await fs.flush();
  }

  private useProject(projectName: string): InstanceType<typeof LightningFS>['promises'] {
    if (this.currentFsProjectName !== projectName) {
      this.fs.init(this.toFsName(projectName), { defer: true });
      this.currentFsProjectName = projectName;
    }
    return this.fs.promises;
  }

  private async readProjectFiles(
    fs: InstanceType<typeof LightningFS>['promises'],
  ): Promise<string[]> {
    try {
      return sortNames(await fs.readdir('/'));
    } catch (error) {
      if (getErrorCode(error) === 'ENOENT') return [];
      throw error;
    }
  }

  private async readFile(
    fs: InstanceType<typeof LightningFS>['promises'],
    fileName: string,
  ): Promise<string> {
    return fs.readFile(this.toFilePath(fileName), 'utf8');
  }

  private requireActiveProject(): string {
    const activeProjectName = this.activeProjectName();
    if (!activeProjectName) {
      throw new Error('Open a project first.');
    }
    return activeProjectName;
  }

  private requireActiveFile(): string {
    const activeFileName = this.activeFileName();
    if (!activeFileName) {
      throw new Error('Open a file first.');
    }
    return activeFileName;
  }

  private validateProjectName(projectName: string): string {
    const normalizedName = normalizeName(projectName);
    if (!normalizedName) {
      throw new Error('Project name is required.');
    }
    if (hasFsNameSeparators(normalizedName)) {
      throw new Error('Project names cannot contain slashes.');
    }
    if (normalizedName === '.' || normalizedName === '..') {
      throw new Error('Choose a different project name.');
    }
    return normalizedName;
  }

  private validateFileName(fileName: string): string {
    const normalizedName = normalizeName(fileName);
    if (!normalizedName) {
      throw new Error('File name is required.');
    }
    if (hasFsNameSeparators(normalizedName)) {
      throw new Error('File names cannot contain slashes.');
    }
    if (normalizedName === '.' || normalizedName === '..') {
      throw new Error('Choose a different file name.');
    }
    return normalizedName;
  }

  private validateKnownProject(projectName: string): string {
    const normalizedName = this.validateProjectName(projectName);
    if (!this.availableProjects().includes(normalizedName)) {
      throw new Error(`Project "${normalizedName}" does not exist.`);
    }
    return normalizedName;
  }

  private validateKnownFile(fileName: string): string {
    const normalizedName = this.validateFileName(fileName);
    if (!this.projectFiles().includes(normalizedName)) {
      throw new Error(`File "${normalizedName}" does not exist.`);
    }
    return normalizedName;
  }

  private toFilePath(fileName: string): string {
    return `/${fileName}`;
  }

  private toFsName(projectName: string): string {
    return `pypad-project-${projectName}`;
  }

  private loadState(): StoredProjectsState {
    try {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!raw) {
        return { projects: [], activeProjectName: null, activeFileByProject: {} };
      }

      const parsed = JSON.parse(raw) as unknown;
      if (
        isObject(parsed) &&
        Array.isArray(parsed['projects']) &&
        (typeof parsed['activeProjectName'] === 'string' || parsed['activeProjectName'] === null) &&
        isObject(parsed['activeFileByProject'])
      ) {
        return {
          projects: sortNames(
            parsed['projects'].filter((projectName): projectName is string => typeof projectName === 'string'),
          ),
          activeProjectName: parsed['activeProjectName'],
          activeFileByProject: Object.entries(parsed['activeFileByProject']).reduce<Record<string, string>>(
            (acc, [projectName, fileName]) => {
              if (typeof projectName === 'string' && typeof fileName === 'string') {
                acc[projectName] = fileName;
              }
              return acc;
            },
            {},
          ),
        };
      }
    } catch {
      // Ignore invalid or unavailable localStorage.
    }

    return { projects: [], activeProjectName: null, activeFileByProject: {} };
  }

  private persistState(): void {
    try {
      localStorage.setItem(
        PROJECTS_STORAGE_KEY,
        JSON.stringify({
          projects: this.availableProjects(),
          activeProjectName: this.state.activeProjectName,
          activeFileByProject: this.state.activeFileByProject,
        } satisfies StoredProjectsState),
      );
    } catch {
      // localStorage may be unavailable.
    }
  }
}
