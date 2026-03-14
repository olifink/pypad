import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

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
    <h2 mat-dialog-title>AI Insert</h2>
    <mat-dialog-content>
      <p>Describe the code you want to insert at the current cursor position.</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>AI Prompt</mat-label>
        <textarea
          matInput
          rows="3"
          [ngModel]="prompt()"
          (ngModelChange)="prompt.set($event)"
          placeholder="e.g., A function to calculate the average of a list"
          cdkFocusInitial></textarea>
        <mat-icon matPrefix>auto_awesome</mat-icon>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!prompt().trim()" (click)="onConfirm()">
        Insert Code
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
  `,
})
export class AiPromptDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AiPromptDialogComponent>);
  protected readonly prompt = signal('');

  protected onCancel(): void {
    this.dialogRef.close();
  }

  protected onConfirm(): void {
    this.dialogRef.close(this.prompt().trim());
  }
}
