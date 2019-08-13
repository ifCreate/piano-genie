/* Variable declaration statement. All the parameters that can be
adjusted on the right side can be adjusted in the following statement. */

// The newSoundType has nine types which are acoustic_grand_piano,
// bright_acoustic_piano, celesta, clavinet, dulcimer,
// electric_grand_piano, electric_piano_1, electric_piano_2,
// and glockenspiel
//
// The newColorType has four combination types which are Normal,
// Summer, Relay, Sunset
//
// The value range of the parameter newTemperature ranges from 0 to
// 1, or there will be an error in console.
var newSoundType = 'electric_piano_2';
var newColorType = 'Summer';
var newTemperature = 0.5;

/* Reset the contents of the above variables, the definition of the
setting method is at the backend, the code is not shown here. */
player.switchPlayer(newSoundType);
changeColor(newColorType);
setTemperature(newTemperature);