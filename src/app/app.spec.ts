import { computed, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TestBed } from '@angular/core/testing';
import JSZip from 'jszip';
import { EMPTY, of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { BoardService } from './board/board.service';
import { ProjectService } from './projects/project.service';
import { ReplService } from './repl/repl.service';
import { RunnerService } from './runner/runner.service';

class FakeWorker implements Worker {
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null;
  onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
  onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null;

  addEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);
  postMessage = vi.fn();
  removeEventListener = vi.fn();
  terminate = vi.fn();
}

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

class FakeDOMRectList extends Array<DOMRect> implements DOMRectList {
  item(index: number): DOMRect | null {
    return this[index] ?? null;
  }
}

class FakeProjectService {
  readonly availableProjects = signal<string[]>([]);
  readonly activeProjectName = signal<string | null>(null);
  readonly activeFileName = signal<string | null>(null);
  readonly projectFiles = signal<string[]>([]);
  readonly isProjectOpen = computed(() => this.activeProjectName() !== null);

  readonly restoreActiveProject = vi.fn(async () => null);
  readonly flush = vi.fn(async () => {});
  readonly queueSaveActiveFile = vi.fn();
  readonly createProject = vi.fn();
  readonly openProject = vi.fn();
  readonly closeProject = vi.fn(async () => {});
  readonly deleteActiveProject = vi.fn(async () => 'demo-project');
  readonly renameActiveProject = vi.fn();
  readonly createFile = vi.fn();
  readonly openFile = vi.fn();
  readonly readActiveProjectFiles = vi.fn(async () => [
    { fileName: 'main.py', code: 'print("Hello")\n' },
    { fileName: 'utils.py', code: 'VALUE = 1\n' },
  ]);
  readonly readActiveProjectModules = vi.fn(async () => ({ main: 'print("main")', utils: 'VALUE = 1' }));
  readonly writeImportedFile = vi.fn();
  readonly renameFile = vi.fn(async (_currentFileName: string, nextFileName: string) => nextFileName);
  readonly renameActiveFile = vi.fn();
  readonly deleteFile = vi.fn(async (fileName: string) => ({
    projectName: 'demo-project',
    fileName: fileName === 'app.py' ? 'utils.py' : 'app.py',
    files: ['app.py', 'utils.py'].filter((name) => name !== fileName),
    code: '# next file',
  }));
}

class FakeRunnerService {
  readonly isReady = signal(true);
  readonly isRunning = signal(false);
  readonly run = vi.fn(() => EMPTY);
  readonly stop = vi.fn();
}

class FakeReplService {
  readonly isReady = signal(true);
  readonly fitAddon = null;
  readonly runInRepl = vi.fn(async () => {});
  readonly setTheme = vi.fn();
  readonly startRepl = vi.fn(async () => {});
  readonly resetRepl = vi.fn(async () => {});
}

class FakeBoardService {
  readonly isConnected = signal(false);
  readonly portLabel = signal<string | null>(null);
  readonly downloadFile = vi.fn(async () => 'print("From Pico")\n');
  readonly uploadFile = vi.fn(async () => {});
  readonly clearFile = vi.fn(async () => {});
  readonly softReset = vi.fn();
  readonly connect = vi.fn(async () => {});
  readonly disconnect = vi.fn(async () => {});
}

class FakeMatDialog {
  readonly open = vi.fn(() => ({
    afterClosed: () => of(undefined as boolean | undefined),
  }));
}

describe('App', () => {
  let boardService: FakeBoardService;
  let dialog: FakeMatDialog;
  let projectService: FakeProjectService;
  let replService: FakeReplService;
  let runnerService: FakeRunnerService;
  let storageState: Record<string, string>;
  let objectUrlCalls: Blob[];

  beforeAll(() => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
        text: async () => '',
      }),
    );
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    Range.prototype.getBoundingClientRect = vi.fn(
      () => new DOMRect(0, 0, 0, 0),
    ) as typeof Range.prototype.getBoundingClientRect;
    Range.prototype.getClientRects = vi.fn(
      () => new FakeDOMRectList(),
    ) as typeof Range.prototype.getClientRects;
    objectUrlCalls = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      objectUrlCalls.push(blob);
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storageState[key] ?? null,
      setItem: (key: string, value: string) => {
        storageState[key] = value;
      },
      removeItem: (key: string) => {
        delete storageState[key];
      },
      clear: () => {
        storageState = {};
      },
      key: (index: number) => Object.keys(storageState)[index] ?? null,
      get length() {
        return Object.keys(storageState).length;
      },
    } satisfies Storage);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    storageState = {};
    objectUrlCalls = [];
    localStorage.clear();
    boardService = new FakeBoardService();
    dialog = new FakeMatDialog();
    projectService = new FakeProjectService();
    replService = new FakeReplService();
    runnerService = new FakeRunnerService();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: BoardService, useValue: boardService },
        { provide: MatDialog, useValue: dialog },
        { provide: ProjectService, useValue: projectService },
        { provide: ReplService, useValue: replService },
        { provide: RunnerService, useValue: runnerService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the toolbar with PyPad title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-title')?.textContent).toContain('PyPad');
  });

  it('should show create project action when no project is open', async () => {
    projectService.availableProjects.set(['demo-project']);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Create project');
    expect(compiled.textContent).toContain('demo-project');
  });

  it('should show active project details when a project is open', async () => {
    projectService.availableProjects.set(['demo-project', 'other-project']);
    projectService.activeProjectName.set('demo-project');
    projectService.activeFileName.set('app.py');
    projectService.projectFiles.set(['app.py', 'utils.py']);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.sidenav-section-label--project-open')?.textContent).toContain(
      'demo-project',
    );
    expect(compiled.querySelector('.project-section-menu-trigger')?.getAttribute('aria-label')).toContain(
      'Project actions for demo-project',
    );
    expect(compiled.querySelector('.project-file-list')).toBeTruthy();
    expect(compiled.querySelector('.project-subsection--files')).toBeNull();
    expect(compiled.querySelector('.app-title')?.textContent).toContain('demo-project');
    expect(compiled.querySelector('.app-subtitle')?.textContent).toContain('app.py');
    expect(compiled.textContent).toContain('utils.py');
    expect(compiled.textContent).toContain('Switch project');
    expect(compiled.textContent).toContain('other-project');
  });

  it('should render overflow menu controls for project files', async () => {
    projectService.availableProjects.set(['demo-project']);
    projectService.activeProjectName.set('demo-project');
    projectService.activeFileName.set('app.py');
    projectService.projectFiles.set(['app.py', 'utils.py']);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const menuButtons = compiled.querySelectorAll('.project-file-menu-trigger');
    expect(menuButtons.length).toBe(2);
    expect(menuButtons[0]?.getAttribute('aria-label')).toContain('More actions for');
  });

  it('should pass project modules to the runner when executing a project file', async () => {
    projectService.activeProjectName.set('demo-project');
    projectService.activeFileName.set('main.py');
    projectService.projectFiles.set(['main.py', 'utils.py']);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    await (fixture.componentInstance as App & { runCode(): Promise<void> }).runCode();

    expect(projectService.flush).toHaveBeenCalled();
    expect(projectService.readActiveProjectModules).toHaveBeenCalled();
    expect(runnerService.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        projectModules: { main: 'print("main")', utils: 'VALUE = 1' },
      }),
    );
  });

  it('should pass project modules to the REPL when executing from the REPL tab', async () => {
    projectService.activeProjectName.set('demo-project');
    projectService.activeFileName.set('main.py');
    projectService.projectFiles.set(['main.py', 'utils.py']);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    (
      fixture.componentInstance as App & {
        activePanelId: { set(value: 'repl'): void };
      }
    ).activePanelId.set('repl');

    await (fixture.componentInstance as App & { runCode(): Promise<void> }).runCode();

    expect(projectService.readActiveProjectModules).toHaveBeenCalled();
    expect(replService.runInRepl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        projectModules: { main: 'print("main")', utils: 'VALUE = 1' },
      }),
    );
    expect(runnerService.run).not.toHaveBeenCalled();
  });

  it('should download the active project as a zip archive', async () => {
    projectService.activeProjectName.set('demo-project');
    projectService.activeFileName.set('main.py');
    projectService.projectFiles.set(['main.py', 'utils.py']);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await (fixture.componentInstance as App & { downloadProjectZip(): Promise<void> }).downloadProjectZip();

    expect(projectService.flush).toHaveBeenCalled();
    expect(projectService.readActiveProjectFiles).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const zipBlob = objectUrlCalls[0];
    expect(zipBlob).toBeInstanceOf(Blob);

    const zip = await JSZip.loadAsync(zipBlob);
    expect(await zip.file('main.py')?.async('string')).toBe('print("Hello")\n');
    expect(await zip.file('utils.py')?.async('string')).toBe('VALUE = 1\n');

    const downloadAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(downloadAnchor.download).toBe('demo-project.zip');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
  });

  it('should show a success message after downloading from Pico', async () => {
    projectService.activeFileName.set('main.py');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as App & {
      downloadFromBoard(): void;
      outputLines(): { text: string; isError: boolean }[];
      activePanelId(): 'output' | 'repl' | 'docs';
    };

    dialog.open.mockReturnValueOnce({
      afterClosed: () => of(true),
    });

    component.downloadFromBoard();
    await fixture.whenStable();

    expect(boardService.downloadFile).toHaveBeenCalledWith('main.py');
    expect(component.outputLines()).toEqual([
      { text: 'Downloaded main.py from Pico.', isError: false },
    ]);
    expect(component.activePanelId()).toBe('output');
  });
});
