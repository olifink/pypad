import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { BoardService } from '../board.service';
import { ProjectService } from '../../projects/project.service';
import { ConfirmDialogComponent } from '../../confirm-dialog/confirm-dialog';
import type { ConfirmDialogData } from '../../confirm-dialog/confirm-dialog';
import type { BoardFile } from '../board-info';

@Component({
  selector: 'app-board-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './board-manager.component.html',
  styleUrl: './board-manager.component.scss',
})
export class BoardManagerComponent implements OnInit {
  protected readonly board = inject(BoardService);
  protected readonly projects = inject(ProjectService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<BoardManagerComponent>);

  protected readonly files = signal<BoardFile[]>([]);
  protected readonly loadingFiles = signal(false);
  protected readonly fileError = signal<string | null>(null);
  protected readonly actionInProgress = signal<string | null>(null);

  protected readonly boardInfo = this.board.boardInfo;
  protected readonly memTotal = computed(() => {
    const info = this.boardInfo();
    if (!info) return 0;
    return info.memFreeKb + info.memAllocKb;
  });
  protected readonly memUsedPercent = computed(() => {
    const info = this.boardInfo();
    if (!info || this.memTotal() === 0) return 0;
    return Math.round((info.memAllocKb / this.memTotal()) * 100);
  });

  protected readonly isProjectOpen = this.projects.isProjectOpen;
  protected readonly activeProjectName = this.projects.activeProjectName;

  ngOnInit(): void {
    void this.refreshFiles();
  }

  protected async refreshFiles(): Promise<void> {
    this.loadingFiles.set(true);
    this.fileError.set(null);
    try {
      const list = await this.board.listFiles('/');
      this.files.set(list);
    } catch (e) {
      this.fileError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loadingFiles.set(false);
    }
  }

  protected async uploadFromEditor(filename: string): Promise<void> {
    // Trigger a file-picker → read the selected local file and push to board.
    const input = Object.assign(document.createElement('input'), {
      type: 'file',
      accept: '.py,.txt,.json,.mpy',
    });
    const file: File | null = await new Promise((resolve) => {
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
      input.click();
    });
    if (!file) return;

    this.actionInProgress.set(`Uploading ${file.name}…`);
    try {
      const content = await file.text();
      await this.board.uploadFile(file.name, content);
      await this.refreshFiles();
    } catch (e) {
      this.fileError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.actionInProgress.set(null);
    }
  }

  protected async downloadFile(file: BoardFile): Promise<void> {
    this.actionInProgress.set(`Downloading ${file.name}…`);
    try {
      const content = await this.board.downloadFile(`/${file.name}`);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.fileError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.actionInProgress.set(null);
    }
  }

  protected deleteFile(file: BoardFile): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Delete ${file.name}`,
          message: `Are you sure you want to permanently delete "${file.name}" from the board?`,
          confirmLabel: 'Delete',
        } satisfies ConfirmDialogData,
        width: '440px',
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean | undefined) => {
        if (!confirmed) return;
        this.actionInProgress.set(`Deleting ${file.name}…`);
        try {
          await this.board.deleteFile(`/${file.name}`);
          await this.refreshFiles();
        } catch (e) {
          this.fileError.set(e instanceof Error ? e.message : String(e));
        } finally {
          this.actionInProgress.set(null);
        }
      });
  }

  protected async syncProject(): Promise<void> {
    this.actionInProgress.set('Reading project files…');
    try {
      const entries = await this.projects.readActiveProjectFiles();
      this.actionInProgress.set(`Syncing ${entries.length} file(s)…`);
      for (const entry of entries) {
        await this.board.uploadFile(entry.fileName, entry.code);
      }
      await this.refreshFiles();
    } catch (e) {
      this.fileError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.actionInProgress.set(null);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
