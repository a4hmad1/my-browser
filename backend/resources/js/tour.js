export function mountTour() {
    const slides = [...document.querySelectorAll('.video-slide')];
    const steps = [...document.querySelectorAll('.step-btn')];
    const play = document.getElementById('btn-toggle-play');
    const next = document.getElementById('btn-next-step');
    let current = 1, playing = true;
    const listeners = [];
    function listen(el, event, fn) { el.addEventListener(event, fn); listeners.push(() => el.removeEventListener(event, fn)); }
    function show(index) {
        current = index;
        slides.forEach(el => el.classList.toggle('active', Number(el.dataset.slide) === current));
        steps.forEach(el => el.classList.toggle('active', Number(el.dataset.step) === current));
        document.getElementById('vid-progress-bar').style.width = `${current / 3 * 100}%`;
        document.getElementById('vid-time-display').textContent = `0:${current * 10} / 0:30`;
    }
    function advance() { show(current % 3 + 1); }
    listen(play, 'click', () => {
        playing = !playing;
        document.getElementById('icon-play').style.display = playing ? 'none' : 'block';
        document.getElementById('icon-pause').style.display = playing ? 'block' : 'none';
    });
    listen(next, 'click', advance);
    steps.forEach(el => listen(el, 'click', () => show(Number(el.dataset.step))));
    const timer = setInterval(() => { if (playing) advance(); }, 4500);
    return () => { clearInterval(timer); listeners.forEach(fn => fn()); };
}
