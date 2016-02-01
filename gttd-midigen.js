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
  track.noteOn(0, notes[0], 0);
  for (var i = 1; i < notes.length; i++) {
    track.noteOn(0, notes[i]);
  }
  track.noteOff(0, notes[0], duration);
  for (var i = 1; i < notes.length; i++) {
    track.noteOff(0, notes[i]);
  }
}

function quietChord(track, notes, duration) {
  track.noteOn(0, notes[0], 0, 30);
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
    'cooperate': [player1Cooperate, player2Cooperate],
    'defect': [player1Defect, player2Defect]
  },
  payoffMatrix: {
    'cooperate': { 'cooperate': [-1, -1], 'defect': [-10, 0] },
    'defect': { 'cooperate': [0, -10], 'defect': [-5, -5] }
  }
};
var chicken = {
  options: ['flight', 'fight'],
  callbacks: {
    'flight': [player1Flight, player2Flight],
    'fight': [player1Fight, player2Fight]
  },
  payoffMatrix: {
    'flight': { 'flight': [0, 0], 'fight': [-1, 1] },
    'fight': { 'flight': [1, -1], 'fight': [-10, -10] }
  }
};
var rockPaperScissors = {
  options: ['paper', 'scissors', 'rock'],
  callbacks: {
    'paper': [player1Paper, player2Paper],
    'scissors': [player1Scissors, player2Scissors],
    'rock': [player1Rock, player2Rock]
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
    var maxPlayer1 = NaN;
    var maxPlayer1Option = null;
    var maxPlayer2 = NaN;
    var maxPlayer2Option = null;

    for (var j = 0; j < game.options.length; j++) {
      player1 = game.options[i];
      player2 = game.options[j];
      payoff = game.payoffMatrix[player1][player2];
      console.log("Player 1: " + player1 + ", Player 2: " + player2 + ", Payoff: " + payoff);

      if (game.hasOwnProperty('callbacks')) {
        player1Callback = game.callbacks[player1][0];
        player2Callback = game.callbacks[player2][1];
        var first = false;
        var last = false;
        if (i == 0 && j == 0) {
          first = true;
        }
        if (i == game.options.length - 1 && j == game.options.length - 1) {
          last = true;
        }
        var player1Wins = payoff[0] >= payoff[1];
        var player2Wins = payoff[1] >= payoff[0];
        player1Callback(track, false, first, false, player1Wins);
        player2Callback(track, false, false, last, player2Wins);
      }

      var possibleNash = true;

      if (isNaN(maxPlayer2) || payoff[1] > maxPlayer2) {
        maxPlayer2 = payoff[1];
        maxPlayer2Option = player2;

        for (var k = 0; k < game.options.length; k++) {
          if (k == i) continue;
          payoffPrime = game.payoffMatrix[game.options[k]][game.options[j]];
          if (payoffPrime[0] > payoff[0]) {
            possibleNash = false;
            maxPlayer1 = NaN;
            maxPlayer1Option = null;
            break;
          }
        }
      } else {
        possibleNash = false;
      }

      if (possibleNash) {
        maxPlayer1 = payoff[0];
        maxPlayer1Option = player1;
      }
    }

    if (maxPlayer1Option != null && maxPlayer2Option != null) {
      nash.push([maxPlayer1Option, maxPlayer2Option]);
      console.log("Nash equilibrium found! Player 1: " + maxPlayer1Option + ", Player 2: " + maxPlayer2Option);
    }
  }

  for (var i = 0; i < nash.length; i++) {
    ne = nash[i];
    
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

function player1Defect(track, nash) {
  prisonersDilemaProgression(track, majorScale(NOTE_C), nash);
}

function player1Cooperate(track, nash) {
  prisonersDilemaProgression(track, minorScale(NOTE_C), nash);
}

function player2Defect(track, nash) {
  prisonersDilemaProgression(track, majorScale(NOTE_A), nash);
}

function player2Cooperate(track, nash) {
  prisonersDilemaProgression(track, minorScale(NOTE_A), nash);
}

function rpsProgression(track, root, scale_note, first, last, wins) {
  var scale;
  if (wins) {
    scale = majorScale(scale_note);
  } else {
    scale = minorScale(scale_note);
  }
  if (last) {
    track.note(0, scale(root - 1), 64, 48);
    chord(track, chordNotes(root, scale), 192);
  } else if (first) {
    track.note(0, scale(root - 1), 64);
    chord(track, chordNotes(root, scale), 96);
    quietChord(track, chordNotes(root, scale), 48);
  } else {
    track.note(0, scale(root - 1), 64, 48);
    chord(track, chordNotes(root, scale), 96);
    quietChord(track, chordNotes(root, scale), 48);
  }
}

function player1Rock(track, nash, first, last, wins) {
  rpsProgression(track, ROOT_TONIC, NOTE_C, first, last, wins);
}
function player1Paper(track, nash, first, last, wins) {
  rpsProgression(track, ROOT_SUBDOMINANT, NOTE_C, first, last, wins);
}
function player1Scissors(track, nash, first, last, wins) {
  rpsProgression(track, ROOT_DOMINANT, NOTE_C, first, last, wins);
}
function player2Rock(track, nash, first, last, wins) {
  rpsProgression(track, ROOT_TONIC, NOTE_A, first, last, wins);
}
function player2Paper(track, nash, first, last, wins) {
  rpsProgression(track, ROOT_SUBDOMINANT,NOTE_A, first, last, wins);
}
function player2Scissors(track, nash, first, last, wins) {
  rpsProgression(track, ROOT_DOMINANT, NOTE_A, first, last, wins);
}

function fightFlightProgression(track, nash, first_root, second_root, split) {
  var scale = majorScale(NOTE_C);
  var func = chord;
  if (nash) {
    func = spread;
  }
  func(track, chordNotes(first_root, scale), 256);
  if (split) {
    func(track, chordNotes(second_root, scale), 128);
    func(track, chordNotes(second_root, scale), 128);
  } else {
    func(track, chordNotes(second_root, scale), 256);
  }
}

function player1Fight(track, nash) {
  fightFlightProgression(track, nash, ROOT_SUBDOMINANT, ROOT_DOMINANT, true);
}
function player1Flight(track, nash) {
  fightFlightProgression(track, nash, ROOT_SUBMEDIANT, ROOT_SUBDOMINANT, true);
}
function player2Fight(track, nash) {
  fightFlightProgression(track, nash, ROOT_MEDIANT, ROOT_SUPERTONIC, false);
}
function player2Flight(track, nash) {
  fightFlightProgression(track, nash, ROOT_SUPERTONIC, ROOT_TONIC, false);
}
