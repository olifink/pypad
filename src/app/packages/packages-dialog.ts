import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { PackagesComponent } from './packages';

@Component({
  selector: 'app-packages-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, PackagesComponent],
  template: `
    <h2 mat-dialog-title>Packages</h2>
    <mat-dialog-content>
      <app-packages />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: 320px;
      max-width: 480px;
      padding-top: 8px !important;
    }
  `,
})
export class PackagesDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PackagesDialogComponent>);
}
