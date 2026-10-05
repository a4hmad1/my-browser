document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const osNavItems = document.querySelectorAll('.os-nav-item');
  const releasePanels = document.querySelectorAll('.release-panel');
  const heroQuickDl = document.getElementById('hero-quick-dl');
  const heroOsLabel = document.getElementById('hero-os-label');
  const progressBox = document.getElementById('download-progress-box');
  const progressFileName = document.getElementById('progress-file-name');

  // Video Tour Elements
  const videoSlides = document.querySelectorAll('.video-slide');
  const stepButtons = document.querySelectorAll('.step-btn');
  const btnTogglePlay = document.getElementById('btn-toggle-play');
  const btnNextStep = document.getElementById('btn-next-step');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const vidProgressBar = document.getElementById('vid-progress-bar');
  const vidTimeDisplay = document.getElementById('vid-time-display');

  // Download Configuration (Universal Direct Downloads & GitHub Releases)
  const DOWNLOADS = window.CINESTREAM_DOWNLOADS || {
    windows: '/api/download?platform=win',
    linux: '/api/download?platform=linux',
    deb: '/api/download?platform=deb'
  };

  // Sync panel links if defined
  const btnDlLinux = document.getElementById('btn-dl-linux');
  const btnDlWin = document.getElementById('btn-dl-windows');
  if (btnDlLinux) btnDlLinux.href = DOWNLOADS.linux;
  if (btnDlWin) btnDlWin.href = DOWNLOADS.windows;

  // Operating System Auto-Detection
  let detectedOS = 'linux';
  const ua = (navigator.userAgent || '').toLowerCase();

  if (ua.includes('win')) {
    detectedOS = 'windows';
    heroOsLabel.textContent = 'Download CineStream for Windows (.exe)';
    heroQuickDl.setAttribute('href', DOWNLOADS.windows);
    heroQuickDl.setAttribute('download', 'CineStream-1.1.0-win-x64-setup.exe');
  } else {
    detectedOS = 'linux';
    heroOsLabel.textContent = 'Download CineStream for Linux (.AppImage)';
    heroQuickDl.setAttribute('href', DOWNLOADS.linux);
    heroQuickDl.setAttribute('download', 'CineStream-1.1.0-linux-x86_64.AppImage');
  }

  // Switch to detected OS panel
  switchPanel(`panel-${detectedOS}`);

  // OS Tab switching
  osNavItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      switchPanel(targetId);
    });
  });

  function switchPanel(panelId) {
    releasePanels.forEach((panel) => {
      if (panel.id === panelId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    osNavItems.forEach((btn) => {
      if (btn.getAttribute('data-target') === panelId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Active Download Trigger
  window.triggerFileDownload = function (url, filename, event) {
    if (event) {
      event.preventDefault();
    }
    progressBox.classList.add('show');
    progressFileName.textContent = `Downloading ${filename}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
    }, 500);

    setTimeout(() => {
      progressBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  };

  // =========================================================================
  // Interactive Walkthrough Video Simulation
  // =========================================================================
  let currentSlide = 1;
  const totalSlides = 3;
  let isPlaying = true;
  let tourTimer = null;

  function showSlide(index) {
    currentSlide = index;
    videoSlides.forEach((slide) => {
      if (parseInt(slide.getAttribute('data-slide'), 10) === index) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    stepButtons.forEach((btn) => {
      if (parseInt(btn.getAttribute('data-step'), 10) === index) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update progress bar and timecode
    const percentage = (index / totalSlides) * 100;
    vidProgressBar.style.width = `${percentage}%`;
    const sec = index * 10;
    vidTimeDisplay.textContent = `0:${sec < 10 ? '0' + sec : sec} / 0:30`;
  }

  function nextSlide() {
    let next = currentSlide + 1;
    if (next > totalSlides) next = 1;
    showSlide(next);
  }

  function startAutoPlay() {
    isPlaying = true;
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    if (tourTimer) clearInterval(tourTimer);
    tourTimer = setInterval(nextSlide, 4500);
  }

  function stopAutoPlay() {
    isPlaying = false;
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    if (tourTimer) clearInterval(tourTimer);
  }

  btnTogglePlay.addEventListener('click', () => {
    if (isPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  });

  btnNextStep.addEventListener('click', () => {
    nextSlide();
  });

  stepButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.getAttribute('data-step'), 10);
      showSlide(step);
      stopAutoPlay();
    });
  });

  // Start video simulation on load
  startAutoPlay();
});
