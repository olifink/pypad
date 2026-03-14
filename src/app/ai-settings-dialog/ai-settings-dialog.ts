import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../storage/storage.service';

@Component({
  selector: 'app-ai-settings-dialog',
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
    <h2 mat-dialog-title>AI Settings</h2>
    <mat-dialog-content>
      <p>Enter your Gemini API Key to enable AI features like code explanation and generation.</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Gemini API Key</mat-label>
        <input
          matInput
          [type]="hideKey() ? 'password' : 'text'"
          [ngModel]="apiKey()"
          (ngModelChange)="apiKey.set($event)"
          placeholder="Enter your API key" />
        <button
          mat-icon-button
          matSuffix
          (click)="hideKey.set(!hideKey())"
          [attr.aria-label]="hideKey() ? 'Show API key' : 'Hide API key'"
          [attr.aria-pressed]="!hideKey()">
          <mat-icon>{{ hideKey() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
      </mat-form-field>
      <p class="hint">
        Your API key is stored locally in your browser and is never sent to our servers.
        You can get a free API key from the <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="onSave()">Save</button>
    </mat-dialog-actions>
  `,
  styles: `
    .full-width {
      width: 100%;
      margin-top: 8px;
    }
    .hint {
      font-size: 0.85rem;
      opacity: 0.7;
      margin-top: 16px;
    }
    a {
      color: var(--md-sys-color-primary);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  `,
})
export class AiSettingsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AiSettingsDialogComponent>);
  private readonly storage = inject(StorageService);

  protected readonly apiKey = signal(this.storage.loadApiKey() ?? '');
  protected readonly hideKey = signal(true);

  protected onCancel(): void {
    this.dialogRef.close();
  }

  protected onSave(): void {
    this.storage.saveApiKey(this.apiKey().trim() || null);
    this.dialogRef.close(true);
  }
}
