import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface TextPromptDialogData {
  title: string;
  label: string;
  confirmLabel: string;
  initialValue?: string;
  message?: string;
  hint?: string;
  placeholder?: string;
}

@Component({
  selector: 'app-text-prompt-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      @if (data.message) {
        <p>{{ data.message }}</p>
      }

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ data.label }}</mat-label>
        <input
          matInput
          [formControl]="value"
          [placeholder]="data.placeholder ?? ''"
          cdkFocusInitial
        />
        @if (data.hint) {
          <mat-hint>{{ data.hint }}</mat-hint>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined">Cancel</button>
      <button mat-flat-button color="primary" (click)="confirm()" [disabled]="value.invalid">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full-width {
      width: 100%;
      margin-top: 8px;
    }
  `,
})
export class TextPromptDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TextPromptDialogComponent>);

  protected readonly data = inject<TextPromptDialogData>(MAT_DIALOG_DATA);
  protected readonly value = new FormControl(this.data.initialValue ?? '', {
    nonNullable: true,
    validators: [Validators.required],
  });

  protected confirm(): void {
    if (this.value.invalid) return;
    this.dialogRef.close(this.value.value.trim());
  }
}
