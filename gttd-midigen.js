var fs = require('fs');
var Midi = require('jsmidgen');

var NOTE_C = 60;
var NOTE_A = 69;

var ROOT_TONIC = 0;
var ROOT_SUPERTONIC = 1;
var ROOT_MEDIANT = 2;
var ROOT_SUBDOMINANT = 3;
var ROOT_DOMINANT = 4;
var ROOT_SUBMEDIANT = 5;
var ROOT_LEADING = 6;

function chord(track, notes, duration) {
  chordWithVolume(track, notes, duration, 90);
}

function chordWithVolume(track, notes, duration, volume) {
  track.noteOn(0, notes[0], 0, volume);
  for (var i = 1; i < notes.length; i++) {
    track.noteOn(0, notes[i]);
  }
  track.noteOff(0, notes[0], duration);
  for (var i = 1; i < notes.length; i++) {
    track.noteOff(0, notes[i]);
  }
}

function spread(track, notes, duration) {
  d = duration / 4;
  track.note(0, notes[0], d);
  track.note(0, notes[2], d);
  track.note(0, notes[1], d);
  track.note(0, notes[2], d);
}

function getScale(from, steps) {
  function mod(n, m) {
    return ((m%n)+n)%n;
  }
  function nthStep(n) {
    return steps[mod(steps.length, n)];
  }
  
  return function(index, octaveWrap) {
    var note = from;
    if (index >= 0) {
      for (var i = 0; i < index; i++) {
        note += nthStep(i);
      }
    } else {
      for (var i = -1; i >= index; i--) {
        note -= nthStep(i);
      }
    }

    if (octaveWrap) {
      var octaveBase = (Math.floor((from - 24) / 12) * 12) + 24;
      note = octaveBase + ((note - octaveBase) % 12);
    }
    
    return note;
  }
}

function majorScale(from) {
  return getScale(from, [2, 2, 1, 2, 2, 2, 1]);
}

function minorScale(from) {
  return getScale(from, [2, 1, 2, 2, 1, 2, 2]);
}

function chordNotes(root, scale) {
  return [scale(root, true), scale(root + 2, true), scale(root + 4, true)];
}

var prisoner = {
  options: ['cooperate', 'defect'],
  callbacks: {
    'cooperate': [
      function(track, nash) { prisonersDilemaProgression(track, minorScale(NOTE_C), nash); },
      function(track, nash) { prisonersDilemaProgression(track, minorScale(NOTE_A), nash); }
    ],
    'defect': [
      function(track, nash) { prisonersDilemaProgression(track, majorScale(NOTE_C), nash); },
      function(track, nash) { prisonersDilemaProgression(track, majorScale(NOTE_A), nash); }
    ]
  },
  payoffMatrix: {
    'cooperate': { 'cooperate': [-1, -1], 'defect': [-10, 0] },
    'defect': { 'cooperate': [0, -10], 'defect': [-5, -5] }
  }
};
var chicken = {
  options: ['flight', 'fight'],
  callbacks: {
    'flight': [
      function(track, nash) { fightFlightProgression(track, nash, ROOT_SUBMEDIANT, ROOT_SUBDOMINANT, true); },
      function(track, nash) { fightFlightProgression(track, nash, ROOT_SUPERTONIC, ROOT_TONIC, false); }
    ],
    'fight': [
      function(track, nash) { fightFlightProgression(track, nash, ROOT_SUBDOMINANT, ROOT_DOMINANT, true); },
      function(track, nash) { fightFlightProgression(track, nash, ROOT_MEDIANT, ROOT_SUPERTONIC, false); }
    ]
  },
  payoffMatrix: {
    'flight': { 'flight': [0, 0], 'fight': [-1, 1] },
    'fight': { 'flight': [1, -1], 'fight': [-10, -10] }
  }
};
var rockPaperScissors = {
  options: ['paper', 'scissors', 'rock'],
  callbacks: {
    'paper': [
      function(track, nash, first, last, wins) { rpsProgression(track, ROOT_SUBDOMINANT, NOTE_C, first, last, wins); },
      function(track, nash, first, last, wins) { rpsProgression(track, ROOT_SUBDOMINANT, NOTE_A, first, last, wins); }
    ],
    'scissors': [
      function(track, nash, first, last, wins) { rpsProgression(track, ROOT_DOMINANT, NOTE_C, first, last, wins); },
      function(track, nash, first, last, wins) { rpsProgression(track, ROOT_DOMINANT, NOTE_A, first, last, wins); }
    ],
    'rock': [
      function(track, nash, first, last, wins) { rpsProgression(track, ROOT_TONIC, NOTE_C, first, last, wins); },
      function(track, nash, first, last, wins) { rpsProgression(track, ROOT_TONIC, NOTE_A, first, last, wins); }
    ]
  },
  payoffMatrix: {
    'paper': { 'paper': [0, 0], 'scissors': [-1, 1], 'rock': [1, -1] },
    'scissors': { 'paper': [1, -1], 'scissors': [0, 0], 'rock': [-1, 1] },
    'rock': { 'paper': [-1, 1], 'scissors': [1, -1], 'rock': [0, 0] }
  }
};

generate('prisoners.mid', "Prisoner's dilema", prisoner);
generate('chicken.mid', "Chicken", chicken);
generate('psr.mid', "Rock Paper Scissors", rockPaperScissors);

function generate(outputFilename, friendlyGameName, game) {
  var file = new Midi.File();
  var track = new Midi.Track();
  file.addTrack(track);

  console.log(friendlyGameName);
  console.log("-----------------");

  playGame(track, game);

  console.log("");

  fs.writeFileSync(outputFilename, file.toBytes(), 'binary');
}

function playGame(track, game) {
  var nash = [];
  
  for (var i = 0; i < game.options.length; i++) {
    var possiblePlayer1Nash = null;
    var possiblePlayer2Nash = null;

    var maxPlayer2 = NaN;

    for (var j = 0; j < game.options.length; j++) {
      var player1 = game.options[i];
      var player2 = game.options[j];
      var payoff = game.payoffMatrix[player1][player2];
      console.log("Player 1: " + player1 + ", Player 2: " + player2 + ", Payoff: " + payoff);

      if (game.hasOwnProperty('callbacks')) {
        var player1Callback = game.callbacks[player1][0];
        var player2Callback = game.callbacks[player2][1];
        var first = i == 0 && j == 0;
        var last = i == game.options.length - 1 && j == game.options.length - 1;
        var player1Wins = payoff[0] >= payoff[1];
        var player2Wins = payoff[1] >= payoff[0];
        player1Callback(track, false, first, false, player1Wins);
        player2Callback(track, false, false, last, player2Wins);
      }

      var possibleNash = false;

      if (isNaN(maxPlayer2) || payoff[1] > maxPlayer2) {
        maxPlayer2 = payoff[1];
        possibleNash = true;
        possiblePlayer1Nash = null;
        possiblePlayer2Nash = null;

        for (var k = 0; k < game.options.length; k++) {
          if (k == i) continue;
          var payoffPrime = game.payoffMatrix[game.options[k]][game.options[j]];
          if (payoffPrime[0] > payoff[0]) {
            possibleNash = false;
            break;
          }
        }
      }

      if (possibleNash) {
        possiblePlayer1Nash = player1;
        possiblePlayer2Nash = player2;
      }
    }

    if (possiblePlayer1Nash != null && possiblePlayer2Nash != null) {
      nash.push([possiblePlayer1Nash, possiblePlayer2Nash]);
      console.log("Nash equilibrium found! Player 1: " + possiblePlayer1Nash + ", Player 2: " + possiblePlayer2Nash);
    }
  }

  for (var i = 0; i < nash.length; i++) {
    var ne = nash[i];
    
    if (game.hasOwnProperty('callbacks')) {
      player1Callback = game.callbacks[ne[0]][0];
      player2Callback = game.callbacks[ne[1]][1];
      player1Callback(track, true, false, false, false);
      player2Callback(track, true, false, false, false);
    }
  }
}

function prisonersDilemaProgression(track, scale, nash) {
  if (nash) {
    spread(track, chordNotes(ROOT_TONIC, scale), 256);
    spread(track, chordNotes(ROOT_DOMINANT, scale), 256);
    spread(track, chordNotes(ROOT_SUBMEDIANT, scale), 256);
    spread(track, chordNotes(ROOT_SUBDOMINANT, scale), 256);
  } else {
    chord(track, chordNotes(ROOT_TONIC, scale), 256);
    chord(track, chordNotes(ROOT_DOMINANT, scale), 128);
    chord(track, chordNotes(ROOT_SUBMEDIANT, scale), 128);
    chord(track, chordNotes(ROOT_SUBDOMINANT, scale), 256);
    chord(track, chordNotes(ROOT_TONIC, scale), 256);
  }
}

function rpsProgression(track, root, scale_note, first, last, wins) {
  var scale = wins ? majorScale(scale_note) : minorScale(scale_note);

  if (last) {
    track.note(0, scale(root - 1), 64, 48);
    chord(track, chordNotes(root, scale), 192);
  } else if (first) {
    track.note(0, scale(root - 1), 64);
    chord(track, chordNotes(root, scale), 96);
    chordWithVolume(track, chordNotes(root, scale), 48, 30);
  } else {
    track.note(0, scale(root - 1), 64, 48);
    chord(track, chordNotes(root, scale), 96);
    chordWithVolume(track, chordNotes(root, scale), 48, 30);
  }
}

function fightFlightProgression(track, nash, first_root, second_root, split) {
  var scale = majorScale(NOTE_C);
  var func = nash ? spread : chord;

  func(track, chordNotes(first_root, scale), 256);
  if (split) {
    func(track, chordNotes(second_root, scale), 128);
    func(track, chordNotes(second_root, scale), 128);
  } else {
    func(track, chordNotes(second_root, scale), 256);
  }
}
