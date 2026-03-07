import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ShareService } from './share.service';
import { toDataURL } from 'qrcode';

export interface ShareDialogData {
  code: string;
}

@Component({
  selector: 'app-share-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule],
  styles: `
    .share-url-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 20px;
    }

    .share-url-field {
      flex: 1;
    }

    .share-url-input {
      font-size: 13px;
      font-family: 'Roboto Mono', monospace;
    }

    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .qr-img {
      width: 200px;
      height: 200px;
      border-radius: 8px;
      display: block;
    }

    .qr-caption {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
      margin: 0;
    }
  `,
  template: `
    <h2 mat-dialog-title>Share</h2>

    <mat-dialog-content>
      <div class="share-url-row">
        <mat-form-field class="share-url-field" appearance="outline" subscriptSizing="dynamic">
          <input
            matInput
            class="share-url-input"
            [value]="shareUrl"
            readonly
            aria-label="Shareable URL"
            (focus)="onUrlFocus($event)"
          />
        </mat-form-field>
        <button
          mat-stroked-button
          (click)="copyUrl()"
          [attr.aria-label]="copied() ? 'Copied' : 'Copy link'">
          <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
          {{ copied() ? 'Copied!' : 'Copy' }}
        </button>
      </div>

      @if (qrDataUrl()) {
        <div class="qr-section">
          <img class="qr-img" [src]="qrDataUrl()" alt="QR code for shareable URL" />
          <p class="qr-caption">Scan to open on another device</p>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
})
export class ShareDialogComponent implements OnInit {
  private readonly data = inject<ShareDialogData>(MAT_DIALOG_DATA);
  private readonly shareService = inject(ShareService);

  protected readonly shareUrl = this.shareService.buildShareUrl(this.data.code);
  protected readonly copied = signal(false);
  protected readonly qrDataUrl = signal('');

  ngOnInit(): void {
    void toDataURL(this.shareUrl, { width: 200, margin: 2, errorCorrectionLevel: 'M' }).then(
      (url) => this.qrDataUrl.set(url),
    );
  }

  protected onUrlFocus(e: FocusEvent): void {
    (e.target as HTMLInputElement).select();
  }

  protected copyUrl(): void {
    void navigator.clipboard.writeText(this.shareUrl).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
