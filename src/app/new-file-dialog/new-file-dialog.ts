import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { AiService } from '../ai/ai.service';

export interface NewFileDialogData {
  title: string;
  message: string;
  requireName?: boolean;
  initialName?: string;
  nameHint?: string;
}

@Component({
  selector: 'app-new-file-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>

      @if (data.requireName) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>File name</mat-label>
          <input
            matInput
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            placeholder="main.py" />
          @if (data.nameHint) {
            <mat-hint>{{ data.nameHint }}</mat-hint>
          }
        </mat-form-field>
      }

      @if (aiService.hasApiKey()) {
        <div class="ai-section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>AI Prompt (optional)</mat-label>
            <textarea
              matInput
              rows="3"
              [ngModel]="prompt()"
              (ngModelChange)="prompt.set($event)"
              placeholder="e.g., Generate a simple web server using MicroPython sockets"></textarea>
            <mat-icon matPrefix>auto_awesome</mat-icon>
            <mat-hint>Leave empty to start with a blank file</mat-hint>
          </mat-form-field>
        </div>
      }
    </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button
          mat-flat-button
          color="primary"
          (click)="onConfirm()"
          [disabled]="data.requireName && !name().trim()">
          {{ prompt().trim() ? 'Generate and Create' : 'Create Blank' }}
        </button>
      </mat-dialog-actions>
  `,
  styles: `
    .full-width {
      width: 100%;
      margin-top: 16px;
    }
    .ai-section {
      margin-top: 8px;
    }
    mat-icon[matPrefix] {
      margin-right: 8px;
      color: var(--md-sys-color-primary);
    }
  `,
})
export class NewFileDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewFileDialogComponent>);
  protected readonly data = inject<NewFileDialogData>(MAT_DIALOG_DATA);
  protected readonly aiService = inject(AiService);
  protected readonly prompt = signal('');
  protected readonly name = signal(this.data.initialName ?? '');

  protected onCancel(): void {
    this.dialogRef.close();
  }

  protected onConfirm(): void {
    if (this.data.requireName && !this.name().trim()) return;
    this.dialogRef.close({
      confirmed: true,
      name: this.name().trim(),
      prompt: this.prompt().trim(),
    });
  }
}
