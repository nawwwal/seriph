/**
 * Utility for announcing status changes to screen readers via ARIA live regions
 */

let announcerElement: HTMLElement | null = null;

/**
 * Initialize the status announcer element
 */
export function initStatusAnnouncer(): void {
  if (typeof window === 'undefined') return;
  
  announcerElement = document.getElementById('status-announcements');
  if (!announcerElement) {
    announcerElement = document.createElement('div');
    announcerElement.id = 'status-announcements';
    announcerElement.setAttribute('aria-live', 'polite');
    announcerElement.setAttribute('aria-atomic', 'true');
    announcerElement.className = 'sr-only';
    document.body.appendChild(announcerElement);
  }
}

/**
 * Announce a status change to screen readers
 */
export function announceStatus(message: string): void {
  if (typeof window === 'undefined') return;
  
  if (!announcerElement) {
    initStatusAnnouncer();
  }
  
  if (announcerElement) {
    // Clear previous message
    announcerElement.textContent = '';
    
    // Use setTimeout to ensure the clear happens before the new message
    setTimeout(() => {
      if (announcerElement) {
        announcerElement.textContent = message;
      }
    }, 100);
  }
}

/**
 * Announce upload status
 */
export function announceUploadStatus(fileName: string, status: string): void {
  announceStatus(`Upload ${status} for ${fileName}`);
}

/**
 * Announce analysis status
 */
export function announceAnalysisStatus(fileName: string, status: string): void {
  announceStatus(`Analysis ${status} for ${fileName}`);
}

