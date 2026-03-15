import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

export interface AiPromptDialogData {
  isFixMode: boolean;
  selectedText?: string;
}

@Component({
  selector: 'app-ai-prompt-dialog',
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
    <h2 mat-dialog-title>{{ data.isFixMode ? 'AI Fix' : 'AI Insert' }}</h2>
    <mat-dialog-content>
      <p>
        {{
          data.isFixMode
            ? 'Describe how you want to modify the selected code.'
            : 'Describe the code you want to insert at the current cursor position.'
        }}
      </p>
      
      @if (data.isFixMode && data.selectedText) {
        <div class="selection-preview">
          <div class="selection-header">Current Selection:</div>
          <pre><code>{{ data.selectedText }}</code></pre>
        </div>
      }

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>AI Prompt</mat-label>
        <textarea
          matInput
          rows="3"
          [ngModel]="prompt()"
          (ngModelChange)="prompt.set($event)"
          [placeholder]="
            data.isFixMode
              ? 'e.g., Rewrite this using a list comprehension'
              : 'e.g., A function to calculate the average of a list'
          "
          cdkFocusInitial></textarea>
        <mat-icon matPrefix>auto_awesome</mat-icon>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!prompt().trim()" (click)="onConfirm()">
        {{ data.isFixMode ? 'Fix Code' : 'Insert Code' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full-width {
      width: 100%;
      margin-top: 8px;
    }
    mat-icon[matPrefix] {
      margin-right: 8px;
      color: var(--md-sys-color-primary);
    }
    .selection-preview {
      background: var(--mat-sys-surface-container-high);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      max-height: 120px;
      overflow-y: auto;
    }
    .selection-header {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    pre {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      white-space: pre-wrap;
      word-break: break-all;
    }
  `,
})
export class AiPromptDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AiPromptDialogComponent>);
  protected readonly data = inject<AiPromptDialogData>(MAT_DIALOG_DATA);
  protected readonly prompt = signal('');

  protected onCancel(): void {
    this.dialogRef.close();
  }

  protected onConfirm(): void {
    this.dialogRef.close(this.prompt().trim());
  }
}
