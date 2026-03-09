import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PackagesService } from './packages.service';

@Component({
  selector: 'app-packages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './packages.html',
  styleUrl: './packages.css',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  host: { class: 'app-packages' },
})
export class PackagesComponent {
  protected readonly pkg = inject(PackagesService);
  protected readonly nameCtrl = new FormControl('', { nonNullable: true });
  protected readonly installError = signal<string | null>(null);

  protected async installPackage(): Promise<void> {
    const name = this.nameCtrl.value.trim();
    if (!name) return;
    this.installError.set(null);
    const result = await this.pkg.install(name);
    if (result.success) {
      this.nameCtrl.reset();
    } else {
      this.installError.set(result.log.trim() || 'Installation failed.');
    }
  }
}
