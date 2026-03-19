import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';
import { ProjectService } from './projects/project.service';

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
  readonly renameActiveProject = vi.fn();
  readonly createFile = vi.fn();
  readonly openFile = vi.fn();
  readonly writeImportedFile = vi.fn();
  readonly renameActiveFile = vi.fn();
}

describe('App', () => {
  let projectService: FakeProjectService;
  let storageState: Record<string, string>;

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
    localStorage.clear();
    projectService = new FakeProjectService();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: ProjectService, useValue: projectService }],
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
    expect(compiled.textContent).toContain('Open project');
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
    expect(compiled.querySelector('.project-name')?.textContent).toContain('demo-project');
    expect(compiled.querySelector('.app-subtitle')?.textContent).toContain('demo-project / app.py');
    expect(compiled.textContent).toContain('Rename current file');
    expect(compiled.textContent).toContain('utils.py');
    expect(compiled.textContent).toContain('other-project');
  });
});
