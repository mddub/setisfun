// See https://github.com/mddub/setisfun

(function () {

// card and board properties
var propertyValues = {
	color: ['green', 'purple', 'red'],
	shape: ['diamond', 'circle', 'oval'],
	fill: ['solid', 'striped', 'open'],
	count: [1,2,3]
	},
	propertyNames = ['color','shape','fill','count'],
	boardSize = 12,
// game settings
	winningSetCount = 10,
	minStartingSets = 2, // minimum # of sets to deal at start of game
// display/effect settings
	messageDelay = 500, // time (ms) to display message before starting to fade out
	lastSetDelay = 5000, // time (ms) to display last set
// game state
	playing = false,
	timeElapsed = 0,
	secretHintModeOn = false;

function formatTime(time) {
	return parseInt(time/60, 10) + ':' + (time%60<10 ? '0' : '') + time%60;
}

// add each element of array 'values' to each array in 'arr', recursively n times
// used to generate cards
function appendValues(arr, values, n) {
	if(n === 0) { return arr; }
	else {
		var result = [];
		for(var i = 0; i < arr.length; i++) {
			var thisArr = arr[i];
			for(var j = 0; j < values.length; j++) {
				var copy = thisArr.slice();
				copy.push(values[j]);
				result.push(copy);
			}
		}
		return appendValues(result, values, n - 1);
	}
}

var Card = function (vals) {
	var properties = {};
	for(var p = 0; p < propertyNames.length; p++) {
		properties[propertyNames[p]] = propertyValues[propertyNames[p]][vals[p]];
	}

	return {
		val: function (index) { return vals[index]; },
		property: function (prop) { return properties[prop]; },
		id: function () { return vals.join('_'); }
	}
};

function findOverlappingDimension(cards) {
	for(var n = 0; n < propertyNames.length; n++) {
		var pCount = {};
		for(var p = 0; p < propertyValues[propertyNames[n]].length; p++) { pCount[p] = 0; }
		for(var c = 0; c < cards.length; c++) {
			pCount[cards[c].val(n)]++;
		}
		for(var p = 0; p < propertyValues[propertyNames[n]].length; p++) {
			if(pCount[p] === 2) {
				return propertyValues[propertyNames[n]][p];
			}
		}
	}
	return '';
}

function findSets(cards) {
	// a very ugly function
	var sets = [];
	for(var a = 0; a < cards.length; a++) {
		for(var b = a + 1; b < cards.length; b++) {
			for(var c = b + 1; c < cards.length; c++) {
				if(findOverlappingDimension([cards[a],cards[b],cards[c]]) === '') {
					sets.push([a,b,c]);
				}
			}
		}
	}
	if(secretHintModeOn) {
		$('#secrethint').remove();
		var hint = $.map(sets, function (set, index) {
			return $.map(set, function (i, index) {
				return String.fromCharCode(i+65);
			}).join(',')
		}).join(' | ');
		$('body').append($('<div id="secrethint" style="width: 532px; text-align: right">' + hint + '</div>'));
	}
	return sets;
}

var Deck = function () {
	function initializeCards() {
		var cards = [];
		var allPropertyCombs = appendValues([[]], [0,1,2], 4);
		for(var i = 0; i < allPropertyCombs.length; i++) {
			cards.push(Card(allPropertyCombs[i]));
		}
		return cards;
	}
	function shuffle(cards) {
		for(var j = cards.length-1; j >= 0; j--) {
			var k = Math.floor(Math.random() * (j+1));
			var temp = cards[k];
			cards[k] = cards[j];
			cards[j] = temp;
		}
	}

	var cards = initializeCards();
	shuffle(cards);

	return {
		deal: function () { return cards.length ? cards.shift() : null; },
		numCards: function () { return cards.length; },
		undeal: function (card) {
			cards.push(card);
			shuffle(cards);
		}
	}
}

var Game = function (container) {

	// make deck
	var deck, cards, cardSelected, numCardsSelected, numSetsFound;
	var myIO;

	function reset() {
		deck = new Deck();
		// initialize cards and their state
		cards = [];
		cardSelected = [];
		numCardsSelected = 0;
		do {
			while(cards.length > 0) {
				deck.undeal(cards.shift());
			}
			for(var i = 0; i < boardSize; i++) {
				cards.push(deck.deal());
				cardSelected.push(false);
			}
		} while(findSets(cards).length < minStartingSets); // minimum number of sets to start
		numSetsFound = 0;
	}

	function testSelectedSet() {
		var possibleSet = [];
		var indices = [];
		for(var i = 0; i < boardSize; i++) {
			if(cardSelected[i]) {
				possibleSet.push(cards[i]);
				indices.push(i);
				cardSelected[i] = false;
			}
		}
		numCardsSelected = 0;
		var dimension = findOverlappingDimension(possibleSet);
		if(dimension === '') {
			// clear the cards
			for(var i = 0; i < 3; i++) { cards[indices[i]] = null; }
			do {
				for(var i = 0; i < 3; i++) {
					if(cards[indices[i]]) {
						deck.undeal(cards[indices[i]]);
						cards[indices[i]] = null;
					}
				}
				for(var i = 0; i < 3; i++) {
					cards[indices[i]] = deck.deal();
				}
			} while(findSets(cards).length === 0);
			numSetsFound++;
			if(numSetsFound === winningSetCount) {
				alert("Wow. You're awesome. You got " + winningSetCount + " sets in " + formatTime(timeElapsed) + ".\n\n" + "Refresh the page to play again.");
				playing = false;
			}
			else {
				myIO.foundSet(possibleSet);
			}
			myIO.updateSetsFound(numSetsFound);
		}
		else {
			myIO.badSet(indices, '2 are ' + dimension);
		}
		// update cards after a delay
		(function () {
			var indicesToUpdate = indices.slice();
			setTimeout(function () {
				for(var i = 0; i < 3; i++) {
					myIO.updateCard([indicesToUpdate[i]]);
				}
			}, 750);
		})();
	}

	return {
		toggleCardSelected: function (index) {
			if(!playing) {
				alert("Refresh the page to play again.");
				return;
			}
			cardSelected[index] = !cardSelected[index];
			cardSelected[index] ? numCardsSelected++ : numCardsSelected--;
			myIO.updateCard([index]);
			if(numCardsSelected === 3) {
				testSelectedSet();
			}
			return cardSelected[index];
		},
		reset: reset,
		start: function () { playing = true; },
		selected: function (index) { return cardSelected[index]; },
		size: function () { return boardSize; },
		getCard: function (i) { return cards[i]; },
		setIO: function (view) { myIO = view; },
		setsFound: function () { return numSetsFound; }
	}
}

var IO = function (game, container) {
	var cardDivs = [];
	var statusDiv;
	var statusSpans = {};
	var highlightColors = {foundSet: '#98fb98', badSet: '#ff3030'};
	function makeBoard(div) {
		// container is jQuery DOM object
		for(var i = 0, size = game.size(); i < size; i++) {
			var card = game.getCard(i);
			var cardDiv = document.createElement('div');
			$(cardDiv).attr('id', 'card_' + i).addClass('card');
			div.append(cardDiv);
			cardDivs.push(cardDiv);
		}
	}
	function showLastSet(cards) {
		$("div#lastset").remove();
		var lastSetDiv = $('<div class="lastset"></div>');
		for(var c = 0; c < cards.length; c++) {
			var thisCard = $(makeCardSvg(cards[c]));
			thisCard.css('width',80).css('height',48);
			lastSetDiv.append(thisCard);
		}
		$(container).parent().append(lastSetDiv);
		$(lastSetDiv).delay(lastSetDelay).fadeOut('slow');
	}
	function makeStatusBar(statusDiv) {
		$(statusDiv).append('<div id="setcount-box">Sets: <span id="setcount">0 of ' + winningSetCount + '</span></div>');
		statusSpans.setcount = $('#setcount');
		$(statusDiv).append('<div id="time-box"><span id="time">0:00</span></div>');
		statusSpans.time = $('#time');
		$(statusDiv).append('<div style="clear:both"></div>');
	}
	function updateTime() {
		if(!playing) return;
		timeElapsed++;
		$('#time').html(formatTime(timeElapsed));
		if(timeElapsed % 60 === 0) {
			$('#time').css('background','#aaa').css('color','#000');
			setTimeout(function () { $('#time').css('background','').css('color',''); }, 500);
		}
		setTimeout(updateTime,1000);
	};
	function highlight(color) {
		container.css('background-color', color);
		setTimeout(function () { container.css('background-color', ''); }, 200);
	}
	function showMessage(message, color) {
		var messageDiv = $('<div style="background: ' + color + '" class="message">' + message + '</div>');
		$('#bottomlink-right').after(messageDiv);
		$(messageDiv).delay(messageDelay).fadeOut('slow');
	}
	function setupCallbacks() {
		for(var i = 0; i < game.size(); i++) {
			// holy s@*% a closure!!!
			$(cardDivs[i]).click(function (j) {
				return function () {
					game.toggleCardSelected(j);
				}
			}(i))
		}
		$(document).keydown(function (event) {
			if(event.keyCode >= 65 && event.keyCode <= 76) {
				game.toggleCardSelected(event.keyCode - 65);
			}
		});
		$('#settingslink').click(function (event) {
			alert("Right now there is one setting: play or not play");
			event.preventDefault();
		});
		$('#highscoreslink').click(function (event) {
			alert("Coming soon");
			event.preventDefault();
		});
		setTimeout(updateTime,1000);
	}
	return {
		initialize: function () {
      // http://www.nczonline.net/blog/2012/07/05/ios-has-a-hover-problem/
      if(!('ontouchstart' in document.documentElement)) {
        $('body').addClass('no-touch');
      }
			makeBoard(container);
			for(var i = 0; i < game.size(); i++)
				this.updateCard([i]);

			statusDiv = $('<div id="status"></div>');
			$(container).before(statusDiv);
			makeStatusBar(statusDiv);

			setupCallbacks();
		},
		updateCard: function (indices) {
			for(var i = 0; i < indices.length; i++) {
				var cardDiv = $(cardDivs[indices[i]]);
				cardDiv.html(makeCardSvg(game.getCard(indices[i]),indices[i]));
				// TODO make card empty slot if null
				cardDiv.toggleClass('selected', game.selected(indices[i]));
			}
		},
		foundSet: function (cards) {
			showMessage(game.setsFound() + ' set' + (game.setsFound()>1?'s':'') + ' found!', highlightColors['foundSet']);
			showLastSet(cards);
		},
		badSet: function (indices, message) {
			showMessage(message, highlightColors['badSet']);
		},
		updateSetsFound: function (numSetsFound) {
			$(statusSpans.setcount).html(numSetsFound + ' of ' + winningSetCount);
		},
		showMessage: showMessage,
	}
}

function makeCardSvg(card, index) {
	var cardWidth = 150, cardHeight = 90;
	var shapeColors = {'green': 'green', 'purple': 'purple', 'red': '#c00'};

	var canvas = document.createElement('canvas');
	$(canvas).attr('width',cardWidth).attr('height',cardHeight);
	var ctx = canvas.getContext('2d');
	ctx.lineWidth = 4;
	ctx.strokeStyle = shapeColors[card.property('color')];
	if(card.property('fill') === 'solid') {
		ctx.fillStyle = shapeColors[card.property('color')];
	}
	else if(card.property('fill') === 'striped') {
		var pattern = document.createElement('canvas');
		$(pattern).attr('width',2).attr('height',5);
		var pCtx = pattern.getContext('2d');
		pCtx.lineWidth = 1.5;
		pCtx.strokeStyle = shapeColors[card.property('color')];
		pCtx.beginPath();
		pCtx.moveTo(0,3);
		pCtx.lineTo(2,3);
		pCtx.stroke();
		ctx.fillStyle = ctx.createPattern(pattern,'repeat');
	}

	var shapeCount = card.property('count');
	var initX = 60 - 20*(shapeCount-1);
	var shapeWidth = 30, shapeHeight = 60;

	for(var i = 0; i < shapeCount; i++) {
		var startX = initX + (30 + 10)*i;
		var radius = shapeWidth/2;
		ctx.beginPath();
		if(card.property('shape') === 'oval') {
			var startY = 30;
			var height = shapeHeight/2;
			ctx.moveTo(startX,startY);
			ctx.lineTo(startX,startY+height);
			ctx.arc(startX+radius,startY+height,radius,Math.PI,Math.PI*2,true);
			ctx.lineTo(startX+radius*2,startY+height);
			ctx.arc(startX+radius,startY,radius,0,Math.PI,true);
		}
		else if(card.property('shape') === 'diamond') {
			var startY = 45;
			ctx.beginPath();
			ctx.moveTo(startX,startY);
			ctx.lineTo(startX+radius,startY+shapeHeight/2);
			ctx.lineTo(startX+radius*2,startY);
			ctx.lineTo(startX+radius,startY-shapeHeight/2);
			ctx.closePath();
		}
		else if(card.property('shape') === 'circle') {
			var startY = 45;
			ctx.arc(startX+radius,startY,radius,0,Math.PI*2,true);
		}
		if(card.property('fill') != 'open')
			ctx.fill();
		ctx.stroke();
	}

	// letters on cards
	if(index || index === 0) {
		ctx.strokeStyle = 'grey';
		ctx.font = '8pt Arial';
		ctx.lineWidth = 1.5;
		ctx.strokeText(String.fromCharCode(index+65),4,12);
	}

	return canvas;
}

$(document).ready(function () {
	var game = new Game();
	var io = new IO(game, $('#set'));
	game.setIO(io);
	game.reset();
	io.initialize();
	game.start();
});

})();
