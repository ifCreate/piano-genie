/*************************
 * Consts for everyone!
 ************************/
let OCTAVES = 7;
let keyWhitelist;
let TEMPERATURE = getTemperature();

const heldButtonToVisualData = new Map();

// Which notes the pedal is sustaining.
let sustaining = false
let sustainingNotes = [];

// Mousedown/up events are weird because you can mouse down in one element and mouse up
// in another, so you're going to lose that original element and never mouse it up.
let mouseDownButton = null;

const player = new Player();
const midiHelper = new MIDIHelper();
const genie = new mm.PianoGenie(CONSTANTS.GENIE_CHECKPOINT);
const painter = new FloatyNotes();
const piano = new Piano();

initEverything();

/*************************
 * Basic UI bits
 ************************/
function initEverything() {
  genie.initialize().then(() => {
    console.log('🧞‍♀️ ready!');
    playBtn.textContent = 'Play';
    playBtn.removeAttribute('disabled');
    playBtn.classList.remove('loading');
  });

  // Start the drawing loop.
  onWindowResize();
  window.requestAnimationFrame(() => painter.drawLoop());

  // Event listeners.
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('orientationchange', onWindowResize);
  window.addEventListener('hashchange', () => TEMPERATURE = getTemperature());
}

function showMainScreen() {
  document.querySelector('.splash').hidden = true;
  document.querySelector('.loaded').hidden = false;

  document.addEventListener('keydown',onKeyDown);
  
  controls.addEventListener('touchstart', (event) => doTouchStart(event), {passive: true});
  controls.addEventListener('touchend', (event) => doTouchEnd(event), {passive: true});
  
  const hasTouchEvents = ('ontouchstart' in window);
  if (!hasTouchEvents) {
    controls.addEventListener('mousedown', (event) => doTouchStart(event));
    controls.addEventListener('mouseup', (event) => doTouchEnd(event));
  }
  
  controls.addEventListener('mouseover', (event) => doTouchMove(event, true));
  controls.addEventListener('mouseout', (event) => doTouchMove(event, false));
  controls.addEventListener('touchenter', (event) => doTouchMove(event, true));
  controls.addEventListener('touchleave', (event) => doTouchMove(event, false));
  canvas.addEventListener('mouseenter', () => mouseDownButton = null);
  
  radioMidiYes.addEventListener('click', () => {
    player.usingMidiOut = true;
    midiOutBox.hidden = false;
  });
  radioMidiNo.addEventListener('click', () => {
    player.usingMidiOut = false;
    midiOutBox.hidden = true;
  });
  
  // Figure out if WebMidi works.
  if (navigator.requestMIDIAccess) {
    midiNotSupported.hidden = true;
    midiSupported.hidden = false;
    navigator.requestMIDIAccess()
      .then(
          (midi) => initMIDI(midi),
          (err) => console.log('Something went wrong', err));
  } else {
    midiNotSupported.hidden = false;
    midiSupported.hidden = true;
  }

  document.addEventListener('keyup', onKeyUp);

  // Slow to start up, so do a fake prediction to warm up the model.
  const note = genie.nextFromKeyWhitelist(0, keyWhitelist, TEMPERATURE);
  genie.resetState();
}

function initMIDI(midi) {
  midiHelper.midiReady(midi);
  midiHelper.onNoteOn = onMIDINoteOn;
  midiHelper.onNoteOff = onMIDINoteOff;
}

// Here touch means either touch or mouse.
function doTouchStart(event) {
  event.preventDefault();
  mouseDownButton = event.target; 
  buttonDown(event.target.dataset.id, true);
}
function doTouchEnd(event) {
  event.preventDefault();
  if (mouseDownButton && mouseDownButton !== event.target) {
    buttonUp(mouseDownButton.dataset.id);
  }
  mouseDownButton = null;
  buttonUp(event.target.dataset.id);
}
function doTouchMove(event, down) {
   // If we're already holding a button down, start holding this one too.
  if (!mouseDownButton)
    return;
  
  if (down)
    buttonDown(event.target.dataset.id, true);
  else 
    buttonUp(event.target.dataset.id, true);
}

/*************************
 * Button actions
 * the value `button` goes from 0 to 7
 ************************/
function buttonDown(button, fromKeyDown) {
  console.log(`Pressing button ${button}`)
  // If we're already holding this button down, nothing new to do.
  if (heldButtonToVisualData.has(button)) {
    return;
  }
  
  const el = document.getElementById(`btn${button}`);
  if (!el)
    return;
  el.setAttribute('active', true);
  
  const note = genie.nextFromKeyWhitelist(button, keyWhitelist, TEMPERATURE);
  const pitch = CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + note;

  // Hear it.
  player.playNoteDown(pitch);
  
  // See it.
  const rect = piano.highlightNote(note, button);
  
  if (!rect) {
    debugger;
  }
  // Float it.
  const noteToPaint = painter.addNote(button, rect.getAttribute('x'), rect.getAttribute('width'));
  heldButtonToVisualData.set(button, {rect:rect, note:note, noteToPaint:noteToPaint});
}

function buttonUp(button) {
  const el = document.getElementById(`btn${button}`);
  if (!el)
    return;
  el.removeAttribute('active');
  
  const thing = heldButtonToVisualData.get(button);
  if (thing) {
    // Don't see it.
    piano.clearNote(thing.rect);
    
    // Stop holding it down.
    painter.stopNote(thing.noteToPaint);
    
    // Maybe stop hearing it.
    const pitch = CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + thing.note;
    if (!sustaining) {
      player.playNoteUp(pitch);
    } else {
      sustainingNotes.push(CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + thing.note);
    }
  }
  heldButtonToVisualData.delete(button);
}

/*************************
 * Events
 ************************/
function onMIDINoteOn(pitch) {
  console.log(`MIDI pitch: ${pitch}`);
  // map pitch to buttons
  const button = getButtonFromMIDI(pitch);
  if (button != null) {
    buttonDown(button, true);
  }
}
function onMIDINoteOff(pitch) {
  const button = getButtonFromMIDI(pitch);
  if (button != null) {
    buttonUp(button, true);
  }
}

function onKeyDown(event) {
  // Keydown fires continuously and we don't want that.
  if (event.repeat) {
    return;
  }
  if (event.keyCode === 32) {  // sustain pedal
    sustaining = true;
  } else if (event.keyCode === 48) { // 0
    console.log('🧞‍♀️ resetting!');
    genie.resetState();
  } else {
    const button = getButtonFromKeyCode(event.keyCode);
    if (button != null) {
      buttonDown(button, true);
    }
  }
}

function onKeyUp(event) {
  if (event.keyCode === 32) {  // sustain pedal
    sustaining = false;
    // Release everything.

    sustainingNotes.forEach((note) => player.playNoteUp(note));
    sustainingNotes = [];
  } else {
    const button = getButtonFromKeyCode(event.keyCode);
    if (button != null) {
      buttonUp(button);
    }
  }
}

function onWindowResize() {
  OCTAVES = window.innerWidth > 700 ? 7 : 3;
  const bonusNotes = OCTAVES > 6 ? 4 : 0;  // starts on an A, ends on a C.
  const totalNotes = CONSTANTS.NOTES_PER_OCTAVE * OCTAVES + bonusNotes; 
  const totalWhiteNotes = CONSTANTS.WHITE_NOTES_PER_OCTAVE * OCTAVES + (bonusNotes - 1); 
  keyWhitelist = Array(totalNotes).fill().map((x,i) => {
    if (OCTAVES > 6) return i;
    // Starting 3 semitones up on small screens (on a C), and a whole octave up.
    return i + 3 + CONSTANTS.NOTES_PER_OCTAVE;
  });
  
  piano.resize(totalWhiteNotes);
  painter.resize(piano.config.whiteNoteHeight);
  piano.draw();
}

/*************************
 * Utils and helpers
 ************************/
const keyToButtonMap = [65,83,68,70,74,75,76,186];
function getButtonFromKeyCode(keyCode) {
  let button = keyCode - 49;
  if (button >= 0 && button < CONSTANTS.NUM_BUTTONS) {
    return button;
  } else if (keyCode === 59) {
    // In Firefox ; has a different keycode. No, I'm not kidding.
    return 7;
  } else {
    button = keyToButtonMap.indexOf(keyCode);
    if (button >= 0 && button < CONSTANTS.NUM_BUTTONS) {
      return button;
    }
  }
  return null;
}

// smaller version; maps to keys in one octave
const midiToButtonMap = [
  [48, 49],
  [50, 51],
  [52],
  [53, 54],
  [55, 56],
  [57, 58],
  [59],
  [60]
]
// wider version that utilizes all 25 keys
// const midiToButtonMap = [
//   [48,49,50],
//   [51,52,53],
//   [54,55,56],
//   [57,58,59],
//   [60,61,62],
//   [63,64,65],
//   [66,67,68],
//   [69,70,71,72]
// ]
function getButtonFromMIDI(pitch) {
  const button = midiToButtonMap.findIndex((notes) => notes.includes(pitch))
  if (button >= 0 && button < CONSTANTS.NUM_BUTTONS) return button;
  // button number invalid.
  return null;
}

function getTemperature() {
  const hash = parseFloat(parseHashParameters()['temperature']) || 0.25;
  const newTemp = Math.min(1, hash);
  console.log('🧞‍♀️ temperature = ', newTemp);
  return newTemp;
}

function parseHashParameters() {
  const hash = window.location.hash.substring(1);
  const params = {}
  hash.split('&').map(hk => {
    let temp = hk.split('=');
    params[temp[0]] = temp[1]
  });
  return params;
}
