var CONSTANTS = {
  COLORS : ['#FF7877','#DC7C8F','#C47D9E','#AD7FAD','#9681BD','#7E84CE','#6686DE','#4589F4'],
  NUM_BUTTONS : 8,
  NOTES_PER_OCTAVE : 12,
  WHITE_NOTES_PER_OCTAVE : 7,
  LOWEST_PIANO_KEY_MIDI_NOTE : 21,
  GENIE_CHECKPOINT : 'model',  
}

var COLORTYPES = {
  Normal: ['#FF7877','#DC7C8F','#C47D9E','#AD7FAD','#9681BD','#7E84CE','#6686DE','#4589F4'],
  Summer: ['#FF205C', '#FF3D37', '#FF581A', '#F89304', '#D8A721', '#96C26B', '#67D2A3', '#42DFCE'],
  Relay: ['#F40C84', '#DB2A8F', '#C2489A', '#AC62A3', '#8A89B1', '#75A1B9', '#56C6C7', '#42DFCE'],
  Sunset: ['#FE035E', '#FC275B', '#FB3959', '#FA5157', '#F77054', '#F59B50', '#F3B84E', '#F0DA4B']
}

/*************************
 * MIDI Helper
 * manages connecting to MIDI inputs,
 * and mapping MIDI pitches to Genie buttons
 ************************/
class MIDIHelper {
  constructor() {
    this.midiIn = [];
    this.midiOut = [];
  }

  midiReady(midi) {
    // Also react to device changes.
    midi.addEventListener('statechange', (event) => this.initDevices(event.target));
    this.initDevices(midi);

    console.log(midi)
  }
  initDevices(midi) {
    // clear current midi in/out
    this.midiIn = [];
    this.midiOut = [];

    const inputs = midi.inputs.values();
    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
      this.midiIn.push(input.value);
    }
    const outputs = midi.outputs.values();
    for (let output = outputs.next(); output && !output.done; output = outputs.next()) {
      this.midiOut.push(output.value);
    }
    // register midi input events
    this.midiIn.forEach(input => {
      input.onmidimessage = (e) => { this.parseMIDIMessage(e) };
    })

    // set up lights
    const launchpadOut = this.midiOut.find(output => output.name === 'Launchpad Mini')
    window.launchpadOut = launchpadOut
    if (!launchpadOut) return;
    // turn off lights
    for (let pitch = 0; pitch < 128; pitch++) {
      launchpadOut.send([128, pitch, 0])
    }
    // turn on lights
    // TODO make the notes not hardcoded
    launchpadOut.send([144, 112, 124])
    launchpadOut.send([144, 113, 3])
    launchpadOut.send([144, 114, 22])
    launchpadOut.send([144, 115, 124])
    launchpadOut.send([144, 116, 3])
    launchpadOut.send([144, 117, 22])
    launchpadOut.send([144, 118, 124])
    launchpadOut.send([144, 119, 3])
  }
  parseMIDIMessage(e) {
    const data = e.data
    // 1st bit of midi data indicates type of event.
    // http://fmslogo.sourceforge.net/manual/midi-table.html
    // for Note on & note off,
    // 2nd bit is the pitch
    // 3rd bit is the velocity

    // 144 - Note on
    if (data[0] === 144) {
      const pitch = data[1]
      const velocity = data[2]
      if (velocity === 0) {
        if (this.onNoteOff) this.onNoteOff(pitch)
      } else {
        if (this.onNoteOn) this.onNoteOn(pitch)
      }
    }
    // 128 - Note off
    if (data[0] === 128) {
      const pitch = data[1]
      if (this.onNoteOff) this.onNoteOff(pitch)
    }
  }
}

 /*************************
 * Magenta player
 ************************/
class Player {
  constructor() {
    this.player = new mm.SoundFontPlayer('sgm_plus/acoustic_grand_piano');
    
    this.loadAllSamples();
  }
  
  loadAllSamples() {
    const seq = {notes:[]};
    for (let i = 0; i < CONSTANTS.NOTES_PER_OCTAVE * OCTAVES; i++) {
      seq.notes.push({pitch: CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + i});
    }
    this.player.loadSamples(seq);
  }
  
  playNoteDown(pitch) {
    // play with the Magenta player.
    mm.Player.tone.context.resume();
    this.player.playNoteDown({pitch:pitch});
  }
  
  playNoteUp(pitch) {
    this.player.playNoteUp({pitch:pitch});
  }

  switchPlayer(newPlayer){
    this.player = new mm.SoundFontPlayer('sgm_plus/' + newPlayer);

    this.loadAllSamples();
  }
}

/*************************
 * Floaty notes
 ************************/
class FloatyNotes {
  constructor() {
    this.notes = [];  // the notes floating on the screen.
    
    this.canvas = document.getElementById('canvas')
    this.context = this.canvas.getContext('2d');
    this.context.lineWidth = 4;
    this.context.lineCap = 'round';
    
    this.contextHeight = 0;
  }
  
  resize(whiteNoteHeight) {
    this.canvas.width = window.innerWidth;
    this.canvas.height = this.contextHeight = window.innerHeight - whiteNoteHeight - 20;
  }
  
  addNote(button, x, width) {
    const noteToPaint = {
        x: parseFloat(x),
        y: 0,
        width: parseFloat(width),
        height: 0,
        color: CONSTANTS.COLORS[button],
        on: true
    };
    this.notes.push(noteToPaint);
    return noteToPaint;
  }
  
  stopNote(noteToPaint) {
    noteToPaint.on = false;
  }
  
  drawLoop() {
    const dy = 3;
    this.context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Remove all the notes that will be off the page;
    this.notes = this.notes.filter((note) => note.on || note.y < (this.contextHeight - 100));

    // Advance all the notes.
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];

      // If the note is still on, then its height goes up but it
      // doesn't start sliding down yet.
      if (note.on) {
        note.height += dy;
      } else {
        note.y += dy;
      }
      
      this.context.globalAlpha = 1 - note.y / this.contextHeight;
      this.context.fillStyle = note.color;
      this.context.fillRect(note.x, note.y, note.width, note.height);
    }
    window.requestAnimationFrame(() => this.drawLoop());
  }
}

class Piano {
  constructor() {
    this.config = {
      whiteNoteWidth: 20,
      blackNoteWidth: 20,
      whiteNoteHeight: 70,
      blackNoteHeight: 2 * 70 / 3
    }
    
    this.svg = document.getElementById('svg');
    this.svgNS = 'http://www.w3.org/2000/svg';
  }
  
  resize(totalWhiteNotes) {
    // i honestly don't know why some flooring is good and some is bad sigh.
    const ratio = window.innerWidth / totalWhiteNotes;
    this.config.whiteNoteWidth = OCTAVES > 6 ? ratio: Math.floor(ratio);
    this.config.blackNoteWidth = this.config.whiteNoteWidth * 2 / 3;
    this.svg.setAttribute('width', window.innerWidth);
    this.svg.setAttribute('height', this.config.whiteNoteHeight);
  }
  
  draw() {
    this.svg.innerHTML = '';
    const halfABlackNote = this.config.blackNoteWidth / 2;
    let x = 0;
    let y = 0;
    let index = 0;

    const blackNoteIndexes = [1, 3, 6, 8, 10];
    
    // First draw all the white notes.
    // Pianos start on an A (if we're using all the octaves);
    if (OCTAVES > 6) {
      this.makeRect(0, x, y, this.config.whiteNoteWidth, this.config.whiteNoteHeight, 'rgba(255,255,255,.07)', '#979797');
      this.makeRect(2, this.config.whiteNoteWidth, y, this.config.whiteNoteWidth, this.config.whiteNoteHeight, 'rgba(255,255,255,.07)', '#979797');
      index = 3;
      x = 2 * this.config.whiteNoteWidth;
    } else {
      // Starting 3 semitones up on small screens (on a C), and a whole octave up.
      index = 3 + CONSTANTS.NOTES_PER_OCTAVE;
    }
    
    // Draw the white notes.
    for (let o = 0; o < OCTAVES; o++) {
      for (let i = 0; i < CONSTANTS.NOTES_PER_OCTAVE; i++) {
        if (blackNoteIndexes.indexOf(i) === -1) {
          this.makeRect(index, x, y, this.config.whiteNoteWidth, this.config.whiteNoteHeight, 'rgba(255,255,255,.07)', '#979797');
          x += this.config.whiteNoteWidth;
        }
        index++;
      }
    }
    
    if (OCTAVES > 6) {
      // And an extra C at the end (if we're using all the octaves);
      this.makeRect(index, x, y, this.config.whiteNoteWidth, this.config.whiteNoteHeight, 'rgba(255,255,255,.07)', '#979797');

      // Now draw all the black notes, so that they sit on top.
      // Pianos start on an A:
      this.makeRect(1, this.config.whiteNoteWidth - halfABlackNote, y, this.config.blackNoteWidth, this.config.blackNoteHeight, '#1B1C2A', '#979797');
      index = 3;
      x = this.config.whiteNoteWidth;
    } else {
      // Starting 3 semitones up on small screens (on a C), and a whole octave up.
      index = 3 + CONSTANTS.NOTES_PER_OCTAVE;
      x = -this.config.whiteNoteWidth;
    }
    
    // Draw the black notes.
    for (let o = 0; o < OCTAVES; o++) {
      for (let i = 0; i < CONSTANTS.NOTES_PER_OCTAVE; i++) {
        if (blackNoteIndexes.indexOf(i) !== -1) {
          this.makeRect(index, x + this.config.whiteNoteWidth - halfABlackNote, y, this.config.blackNoteWidth, this.config.blackNoteHeight, '#1B1C2A', '#979797');
        } else {
          x += this.config.whiteNoteWidth;
        }
        index++;
      }
    }
  }
  
  highlightNote(note, button) {
    // Show the note on the piano roll.
    const rect = this.svg.querySelector(`rect[data-index="${note}"]`);
    if (!rect) {
      console.log('couldnt find a rect for note', note);
      return;
    }
    rect.setAttribute('active', true);
    rect.setAttribute('class', `color-${button}`);
    return rect;
  }
  
  clearNote(rect) {
    rect.removeAttribute('active');
    rect.removeAttribute('class');
  }
  
  makeRect(index, x, y, w, h, fill, stroke) {
    const rect = document.createElementNS(this.svgNS, 'rect');
    rect.setAttribute('data-index', index);
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', fill);
    if (stroke) {
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', '1px');
    }
    this.svg.appendChild(rect);
    return rect;
  }
}