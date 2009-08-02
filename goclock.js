var GoClock = (function init() {

/*
 * Nützliche Konstanten
 */

var SECOND = 1000;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var LOST = '--:--';

/*
 * Utilities
 */

function log(/*...*/) {
	if (typeof console !== 'undefined')
		console.log.apply(console, arguments);
}

function join(delim, values) {
	if (values.length == 0)
		return '';
	if (values.length == 1)
		return values[0];
	var result = '';
	for (var i in values) {
		result += delim;
		result += values[i];
	}
	return result.substr(delim.length);
}

function formatStack(stack) {
	var result = stack.split(/\n/);
	for (var i in result.reverse()) {
		result[i] = result[i].replace(/^(.*)@(.*):(\d+)$/m,
			function(whole, fn, file, lineno) {
				return '' + file + ':' + lineno + ': ' + fn;
			}
		);
	}
	return join('\n', result);
}

function andLog(e) {
	log(formatStack(e.stack));
	return e;
}

var requirements = 0;

function fail(msg) {
	throw andLog(new Error('Assertion failed: ' + msg));
}

function describe(obj) {
	var type = typeof obj;
	if (obj !== undefined && obj.className)
		type = obj.className;
	return type + ' "' + obj + '"';
}

function requireEquals(a, b) {
	if (typeof a != typeof b || a != b) {
		fail('expected ' + describe(a) +
			', got ' + describe(b) + '.');
	}
	requirements++;
	return b;
}

function requireTrue(cond) {
	if (cond !== true)
		fail('expected true, got ' + describe(cond) + '.');
	requirements++;
	return cond;
}

function requireFalse(cond) {
	if (cond !== false)
		fail('expected false, got ' + describe(cond) + '.');
	requirements++;
	return cond;
}

function requireNull(obj) {
	if (obj !== null)
		fail('expected null, got ' + describe(obj) + '.');
	requirements++;
	return obj;
}

function requireNotNull(obj) {
	if (obj === undefined || obj === null)
		fail('expected Nonnull, got ' + describe(obj) + '.');
	requirements++;
	return obj;
}

function requireType(obj, type) {
	if (typeof obj !== type)
		fail('expected a ' + type + ', got ' + describe(obj) + '.');
	requirements++;
	return obj;
}

function requireValue(obj) {
	if (obj === undefined || obj === null)
		fail('expected a value, got ' + describe(obj) + '.');
	requirements++;
	return obj;
}

var V = requireValue; /* Eine komfortable Abkürzung */

function requireIntRange(min, obj, max) {
	if (typeof obj != 'number')
		fail('expected a number, got ' + describe(obj) + '.');
	if (Math.floor(obj) != obj)
		fail('expected an integer, got ' + obj + '.');
	if (min !== undefined && !(min <= obj))
		fail('expected ' + obj + ' to be >= ' + min + '.');
	if (max !== undefined && !(obj < max))
		fail('expected ' + obj + ' to be < ' + max + '.');
	requirements++;
	return obj;
}

function requireBoolean(obj) {
	if (typeof obj != 'boolean')
		fail('expected a boolean, got ' + describe(obj) + '.');
	requirements++;
	return obj;
}

function requireClass(obj, clazz) {
	requireEquals(V(clazz).prototype.className, V(obj).className);
	requirements++;
	return obj;
}

function requireCall(func, args) {
	requireEquals(func.length, args.length);
	return undefined;
}

function dir(obj) {
	var result = '';
	for (var i in V(obj)) {
		try {
			result += '' + i + '=' + obj[i] + '\n';
		} catch (e) {
			result += '! ' + e + '\n';
		}
	}
	return result;
}

function notImplemented(name) {
	fail('Not implemented: ' + name);
}

function twoDigits(obj) {
	var result = '' + requireIntRange(0, obj);
	while (result.length < 2)
		result = '0' + result;
	return result;
}

function threeDigits(obj) {
	var result = '' + requireIntRange(0, obj);
	while (result.length < 3)
		result = '0' + result;
	return result;
}

function parseTime(str) {
	var m = /^(\d+):(\d+):(\d+)$/.exec(requireType(str, 'string'));
	if (m == null && (m = /^()(\d+):(\d+)$/.exec(str)) != null)
		m[1] = '0';
	if (m == null)
		fail('Illegal time value ' + describe(str) + '.');
	var hours = parseInt(m[1], 10);
	var minutes = parseInt(m[2], 10);
	var seconds = parseInt(m[3], 10);
	return hours * HOUR + minutes * MINUTE + seconds * SECOND;
}

function formatTime(time) {
	requireIntRange(0, time);

	var seconds = Math.floor(time / SECOND) % 60;
	var minutes = Math.floor(time / MINUTE) % 60;
	var hours = Math.floor(time / HOUR);
	var shortFormat = twoDigits(minutes) + ':' + twoDigits(seconds);
	if (hours == 0)
		return shortFormat;
	return twoDigits(hours) + ':' + shortFormat;
}

function now() {
	return new Date().getTime();
}

var proto; /* Für syntaktisch einfache Klassen- und Methodendefinitionen. */

function makeClass(constructorFunction, prototypeObject) {
	proto = constructorFunction.prototype = prototypeObject;
	proto.className = 'GoClock.' + constructorFunction.name;
}

function method(func) {
	proto[func.name] = func;
}

/*
 * Clock
 */

makeClass(Clock, new Object());

/**
 * Erzeugt eine neue Uhr für {players} Spieler mit dem Zeitsystem
 * {timeSystem}. Ein Zeitsystem ist zustandslos, jegliche Änderungen
 * finden nur innerhalb der Uhr statt.
 */
function Clock(players, timeSystem) {
	requireCall(Clock, arguments);
	requireIntRange(1, players);
	//requireClass(timeSystem, TimeSystem);

	/* Das benutzte Zeitsystem. */
	this.timeSystem = V(timeSystem);

	/* Die Anzahl der Spieler, die diese Uhr verwaltet. */
	this.players = players;

	/*
	 * Der jeweils aktuelle Zustand der Uhr zu Beginn des aktuellen
	 * Zuges. Dies kann ein beliebiges Objekt sein und wird von der
	 * Uhr nicht interpretiert. Es wird lediglich an die Methoden
	 * des Zeitsystems übergeben.
	 */
	this.state = timeSystem.getStartState(players);

	/*
	 * 'stopped': Entweder lief die Uhr bisher noch garnicht, oder
	 *	es läuft gerade kein Zug.
	 * 'running': Die Uhr läuft gerade für einen der Spieler.
	 * 'paused': Die Uhr läuft eigentlich gerade für einen der
	 *	Spieler, ist aber gerade angehalten.
	 */
	this.status = 'stopped';

	/*
	 * Nur bei 'running' oder 'paused': Nummer des Spielers, dessen
	 * Uhr gerade läuft.
	 */
	delete this.currentPlayer;

	/*
	 * Nur bei 'running' oder 'paused': die Zeit in Millisekunden,
	 * die der aktuelle Zug schon gelaufen ist, bevor die Uhr
	 * pausiert wurde.
	 */
	delete this.currentDuration;

	/*
	 * Nur bei 'running': der Zeitpunkt, zu dem die Uhr gestartet
	 * wurde.
	 */
	delete this.startTime;

	/*
	 * Eine Funktion, die aufgerufen wird, sobald ein Ereignis bei
	 * der Uhr stattfindet. Beispiele für Ereignisse:
	 * <ul>
	 * <li>timeleft(player, time): Der Spieler {player} hat noch
	 *	{time} Millisekunden im aktuellen Zeitabschnitt.</li>
	 * <li>phase(player, old, new): Der Spieler {player} verlässt
	 *	die Phase {old} des Spiels und tritt in Phase {new}
	 *	ein.</li>
	 * <li>lost(player): Die Uhr für Spieler {player} ist
	 *	abgelaufen.</li>
	 * <li>penalty(player, points): Der Spieler {player} bekommt
	 *	{points} Strafpunkte.</li>
	 * <li>display(): Die anzuzeigende Zeit von mindestens einem
	 *	Spieler hat sich geändert und sollte mit {displayTime}
	 *	aktualisiert werden.</li>
	 * </ul>
	 * Die Funktion wird mit den folgenden Parametern aufgerufen:
	 * <ul>
	 * <li>clock: Die Uhr, von der das Ereignis ausgeht.</li>
	 * <li>event: Der Name des Ereignisses.</li>
	 * <li>...: Die Argumente des Ereignisses.</li>
	 * </ul>
	 * <p>TODO: implementieren</p>
	 */
	delete this.eventHandler;
}

/**
 * Startet die Uhr für Spieler {player}. Falls eine andere Uhr gerade
 * läuft, wird sie angehalten. Die Zeit beginnt zu laufen, bis pause()
 * aufgerufen wird oder die Uhr eines anderen Spielers gestartet wird.
 */
method(function start(player) {
	requireCall(start, arguments);
	requireIntRange(0, player, this.players);
	requireFalse(this.timeSystem.hasLost(this.state, player));

	if (this.currentPlayer == player) {
		if (this.status == 'paused')
			this.cont();
		if (this.status == 'running')
			return;
	}

	if (this.status != 'stopped')
		this.finishMove();

	this.currentPlayer = player;
	this.currentDuration = 0;
	this.startTime = now();
	this.status = 'running';
});

/**
 * Hält die Uhr an, die gerade läuft. Falls keine Uhr läuft, passiert
 * nichts.
 */
method(function pause() {
	requireCall(pause, arguments);

	if (this.status != 'running')
		return;

	this.currentDuration = this.duration();
	delete this.startTime;
	this.status = 'paused';
});

/**
 * Lässt die Uhr weiterlaufen, nachdem sie pausiert hatte.
 */
method(function cont() {
	requireCall(cont, arguments);
	requireEquals('paused', this.status);

	this.startTime = now();
	this.status = 'running';
});

method(function finishMove() {
	requireCall(finishMove, arguments);
	requireEquals('running', this.status);

	this.state = this.timeSystem.used(this.state, V(this.currentPlayer),
		this.duration(), true);
	delete this.currentPlayer;
	delete this.currentDuration;
	delete this.startTime;
	this.status = 'stopped';
});

/**
 * Prüft, ob diese Uhr gerade läuft.
 */
method(function running() {
	requireCall(running, arguments);

	return (this.status == 'running');
});

/**
 * Ermittelt, wie lange die Uhr schon für diesen Zug läuft.
 */
method(function duration() {
	requireCall(duration, arguments);

	if (this.status == 'running')
		return V(this.currentDuration) + now() - V(this.startTime);
	if (this.status == 'paused')
		return V(this.currentDuration);
	requireEquals('running|paused', this.status);
});

/**
 * Gibt die Zeit zurück, die auf der Uhr angezeigt werden soll.
 * Falls die Zeit abgelaufen ist, wird "--:--" zurückgegeben.
 */
method(function displayTime(player) {
	requireCall(displayTime, arguments);
	requireIntRange(0, player, this.players);

	var ts = this.timeSystem;
	var state = this.state;
	if (this.status == 'running' || this.status == 'paused') {
		state = ts.used(state, this.currentPlayer,
			this.duration(), false);
	}
	if (ts.hasLost(state, player))
		return LOST;
	return ts.displayTime(state, player);
});

method(function hasLost(player) {
	requireCall(hasLost, arguments);
	requireIntRange(0, player, this.players);

	var ts = this.timeSystem;
	var state = this.state;
	if (this.status == 'running' || this.status == 'paused') {
		state = ts.used(state, this.currentPlayer,
			this.duration(), false);
	}
	return ts.hasLost(state, player);
});

method(function setEventHandler(handler) {
	this.eventHandler = handler;
});

method(function destroy() {

});

/*
 * TimeSystem
 */

makeClass(TimeSystem, new Object());

function TimeSystem() {
	requireCall(TimeSystem, arguments);
}

/**
 * Gibt den Startzustand für eine Uhr mit {players} Spielern zurück.
 * Der Zustand kann ein beliebiges Objekt sein. Er wird weder von der
 * Uhr noch von irgendwem sonst interpretiert.
 */
method(function getStartState(players) {
	requireCall(getStartState, arguments);
	notImplemented('TimeSystem.getStartTime');
});

/**
 * Gibt die Zeit zurück, die angezeigt werden soll, wenn die Uhr sich
 * im Zustand {state} befindet.
 * <p>
 * Achtung: Bei einigen Zeitsystemen (Fischer, Kanadisches Byoyomi) ist
 * die angezeigte Zeit abhängig davon, ob der Zustand einen
 * abgeschlossenen Zug repräsentiert oder einen derzeit laufenden.
 *
 * @param state
 *	Der Zustand, der angezeigt werden soll.
 * @param player
 *	Der Spieler, dessen verbleibende Zeit angezeigt werden soll.
 */
method(function displayTime(state, player) {
	requireCall(displayTime, arguments);
	notImplemented('TimeSystem.displayTime');
});

/**
 * Berechnet den neuen Zustand der Uhr, ausgehend von einem vorherigen
 * Zustand und der seitdem vergangenen Zeit.
 *
 * @param state
 *	Der Ausgangszustand der Uhr. Er muss abgeschlossen sein.
 * @param player
 *	Der Spieler, der gerade am Zug ist.
 * @param duration
 *	Die Zeit, die seit dem Beginn des Zuges vergangen ist, in
 *	Millisekunden.
 * @param finished Ob der Zug abgeschlossen ist.
 */
method(function used(state, player, duration, finished) {
	requireCall(used, arguments);
	notImplemented('TimeSystem.used');
});

/**
 * Prüft, ob {state} einen Zustand darstellt, in dem die Zeit
 * für Spieler {player} abgelaufen ist.
 * <p>
 * Achtung: Wenn die Zeit in einem nicht-abgeschlossener Zustand
 * abgelaufen ist, muss sie das auch in jedem Zustand sein, der
 * daraus entstehen kann.
 */
method(function hasLost(state, player) {
	requireCall(hasLost, arguments);
	notImplemented('TimeSystem.hasLost');
});

/*
 * SuddenDeath
 */

makeClass(SuddenDeathState, new Object());

function SuddenDeathState(players) {
	requireCall(SuddenDeathState, arguments);

	this.players = requireIntRange(1, players);
	this.time = {};
}

makeClass(SuddenDeath, new TimeSystem());

function SuddenDeath(time) {
	requireCall(SuddenDeath, arguments);

	TimeSystem.call(this);
	this.time = parseTime(time);
};

method(function getStartState(players) {
	requireCall(getStartState, arguments);
	
	var state = new SuddenDeathState(requireIntRange(1, players));
	for (var i = 0; i < players; i++)
		state.time[i] = this.time;
	return state;
});

method(function displayTime(state, player) {
	requireCall(displayTime, arguments);
	requireClass(state, SuddenDeathState);
	requireIntRange(0, player, state.players);
	requireFalse(this.hasLost(state, player));

	return formatTime(state.time[player]);
});

method(function used(state, player, duration, finished) {
	requireCall(used, arguments);
	requireClass(state, SuddenDeathState);
	requireIntRange(0, player, state.players);
	requireIntRange(0, duration);

	var result = new SuddenDeathState(state.players);
	for (var i = 0; i < state.players; i++)
		result.time[i] = state.time[i];
	result.time[player] -= duration;
	return result;
});

method(function hasLost(state, player) {
	requireCall(hasLost, arguments);
	requireClass(state, SuddenDeathState);

	return state.time[requireIntRange(0, player, state.players)] < 0;
});

/*
 * Hour Glass
 */

makeClass(HourGlassState, new Object());

function HourGlassState(players, active) {
	requireCall(HourGlassState, arguments);

	this.players = players;
	this.active = active;
}

makeClass(HourGlass, new TimeSystem());

function HourGlass(time) {
	requireCall(HourGlass, arguments);

	TimeSystem.call(this);
	this.time = parseTime(time);
}

method(function getStartState(players) {
	requireCall(getStartState, arguments);
	requireIntRange(2, players);

	var result = new HourGlassState(players, players);
	for (var i = 0; i < players; i++)
		result[i] = this.time;
	return result;
});

method(function used(state, player, duration, finished) {
	requireCall(used, arguments);
	requireClass(state, HourGlassState);
	requireIntRange(0, player, state.players);
	requireIntRange(0, duration);

	var result = new HourGlassState(state.players, state.active);
	for (var i = 0; i < state.players; i++)
		result[i] = state[i];

	var timeLeft = duration;
	var beneficiaries = result.active - 1;
	if (duration <= result[player]) {
		result[player] -= duration;
	} else {
		timeLeft = result[player];
		result.active--;
		result[player] = -1;
	}

	for (var i = 0; i < result.players; i++) {
		if (i != player && result[i] >= 0)
			result[i] += timeLeft / beneficiaries;
	}
	return result;
});

method(function displayTime(state, player) {
	requireCall(displayTime, arguments);
	requireClass(state, HourGlassState);
	requireIntRange(0, player, state.players);
	requireFalse(this.hasLost(state, player));

	return formatTime(Math.floor(state[player]));
});

method(function hasLost(state, player) {
	requireCall(hasLost, arguments);
	requireClass(state, HourGlassState);
	requireIntRange(0, player, state.players);

	return state[player] < 0;
});

/*
 * Fischer
 */

makeClass(FischerState, new Object());

function FischerState(players) {
	requireCall(FischerState, arguments);
	this.players = players;
	this.time = {};
}

makeClass(Fischer, new TimeSystem());

function Fischer(time, timePerMove) {
	requireCall(Fischer, arguments);

	TimeSystem.call(this);
	this.time = parseTime(time);
	this.timePerMove = parseTime(timePerMove);
}

method(function getStartState(players) {
	requireCall(getStartState, arguments);
	requireIntRange(1, players);

	var result = new FischerState(players);
	for (var i = 0; i < players; i++)
		result.time[i] = this.time;

	return result;
});

method(function used(state, player, duration, finished) {
	requireCall(used, arguments);
	requireClass(state, FischerState);
	requireIntRange(0, player, state.players);
	requireIntRange(0, duration);
	requireBoolean(finished);

	var result = new FischerState(state.players);
	for (var i = 0; i < state.players; i++)
		result.time[i] = state.time[i];

	result.time[player] -= duration;
	if (finished && result.time[player] >= 0)
		result.time[player] += this.timePerMove;

	return result;
});

method(function displayTime(state, player) {
	requireCall(displayTime, arguments);
	requireClass(state, FischerState);
	requireIntRange(0, player, state.players);
	requireFalse(this.hasLost(state, player));

	return formatTime(state.time[player]);
});

method(function hasLost(state, player) {
	requireCall(hasLost, arguments);
	requireClass(state, FischerState);
	requireIntRange(0, player, state.players);

	return state.time[player] < 0;
});

/*
 * Capped Fischer
 */

makeClass(CappedFischer, new TimeSystem());

function CappedFischer(time, timePerMove, maxTime) {
	requireCall(CappedFischer, arguments);

	TimeSystem.call(this);
	this.time = parseTime(time);
	this.timePerMove = parseTime(timePerMove);
	this.maxTime = parseTime(maxTime);
}

method(Fischer.prototype.getStartState);

method(function used(state, player, duration, finished) {
	var result = Fischer.prototype.used.apply(this, arguments);
	if (result.time[player] > this.maxTime)
		result.time[player] = this.maxTime;
	return result;
});

method(Fischer.prototype.displayTime);

method(Fischer.prototype.hasLost);

/*
 * Bronstein
 */

makeClass(BronsteinState, new Object());

function BronsteinState(players) {
	requireCall(BronsteinState, arguments);
	this.players = players;
	this.time = {};
}

makeClass(Bronstein, new TimeSystem());

function Bronstein(time, timePerMove) {
	requireCall(Bronstein, arguments);

	TimeSystem.call(this);
	this.time = parseTime(time);
	this.timePerMove = parseTime(timePerMove);
}

method(function getStartState(players) {
	requireCall(getStartState, arguments);
	requireIntRange(1, players);

	var result = new BronsteinState(players);
	for (var i = 0; i < players; i++)
		result.time[i] = this.time;

	return result;
});

method(function used(state, player, duration, finished) {
	requireCall(used, arguments);
	requireClass(state, BronsteinState);
	requireIntRange(0, player, state.players);
	requireIntRange(0, duration);
	requireBoolean(finished);

	var result = new BronsteinState(state.players);
	for (var i = 0; i < state.players; i++)
		result.time[i] = state.time[i];

	if (duration > this.timePerMove)
		result.time[player] -= (duration - this.timePerMove);
	if (duration < this.timePerMove && !finished) {
		result.currentPlayer = player;
		result.timeLeft = this.timePerMove - duration;
	}
	return result;
});

method(function displayTime(state, player) {
	requireCall(displayTime, arguments);
	requireClass(state, BronsteinState);
	requireIntRange(0, player, state.players);
	requireFalse(this.hasLost(state, player));

	if (state.currentPlayer == player) {
		return formatTime(state.time[player]) +
			' + ' + formatTime(state.timeLeft);
	}
	return formatTime(state.time[player]);
});

method(function hasLost(state, player) {
	requireCall(hasLost, arguments);
	requireClass(state, BronsteinState);
	requireIntRange(0, player, state.players);

	return V(state.time[player]) < 0;
});

/*
 * Japanese Byoyomi
 */

makeClass(ByoyomiState, new Object());

function ByoyomiState(players) {
	requireCall(ByoyomiState, arguments);
	this.players = players;
	this.time = {};
	this.periods = {};
	this.byoyomiTime = {};
}

makeClass(Byoyomi, new TimeSystem());


function Byoyomi(time, timePerMove, periods) {
	requireCall(Byoyomi, arguments);
	requireIntRange(0, periods);

	TimeSystem.call(this);
	this.time = parseTime(time);
	this.timePerMove = parseTime(timePerMove);
	this.periods = periods;
}

method(function getStartState(players) {
	requireCall(getStartState, arguments);
	requireIntRange(1, players);

	var result = new ByoyomiState(players);
	for (var i = 0; i < players; i++) {
		result.time[i] = this.time;
		result.periods[i] = this.periods;
	}
	return result;
});

method(function used(state, player, duration, finished) {
	requireCall(used, arguments);
	requireClass(state, ByoyomiState);
	requireIntRange(0, player, state.players);
	requireIntRange(0, duration);
	requireBoolean(finished);

	var result = new ByoyomiState(state.players);
	for (var i = 0; i < state.players; i++) {
		result.time[i] = state.time[i];
		result.periods[i] = state.periods[i];
	}

	var time = result.time[player];
	var periods = result.periods[player];
	var byoyomiTime;
	var rest = duration;

	var min = Math.min(rest, time);
	rest -= min;
	time -= min;
	while (rest >= this.timePerMove && periods > 0) {
		periods--;
		rest -= this.timePerMove;
	}
	if (rest > 0 && periods == 0)
		time = -1;
	byoyomiTime = this.timePerMove - (finished ? 0 : rest);

	result.time[player] = time;
	result.periods[player] = periods;
	if (time == 0)
		result.byoyomiTime[player] = byoyomiTime;

	return result;
});

method(function displayTime(state, player) {
	requireCall(displayTime, arguments);
	requireClass(state, ByoyomiState);
	requireIntRange(0, player, state.players);
	requireFalse(this.hasLost(state, player));

	var time = state.time[player];
	var periods = state.periods[player];
	var byoyomiTime = state.byoyomiTime[player];

	if (byoyomiTime !== undefined && periods == 1)
		return formatTime(byoyomiTime) + ' (SD)';
	if (byoyomiTime !== undefined) {
		return formatTime(byoyomiTime) +
			' (' +  periods + ' \xd7 ' +
			formatTime(this.timePerMove) + ')';
	}
	return formatTime(time) + ' + ' +  periods +
		' \xd7 ' + formatTime(this.timePerMove);
});

method(function hasLost(state, player) {
	requireCall(hasLost, arguments);
	requireClass(state, ByoyomiState);
	requireIntRange(0, player, state.players);

	return state.time[player] < 0;
});

/*
 * Canadian Byoyomi
 */

makeClass(CanadianState, new Object());

function CanadianState(players) {
	requireCall(CanadianState, arguments);
	this.players = players;
	this.time = {};
	this.moves = {};
	this.nextMoves = {};
}

makeClass(Canadian, new TimeSystem());

function Canadian(time, timePerPeriod, movesPerPeriod, movesDelta) {
	requireCall(Canadian, arguments);
	requireIntRange(1, movesPerPeriod);
	requireIntRange(0, movesDelta || 0);

	TimeSystem.call(this);
	this.time = parseTime(time);
	this.timePerPeriod = parseTime(timePerPeriod);
	this.movesPerPeriod = movesPerPeriod;
	this.movesDelta = movesDelta || 0;
}

method(function getStartState(players) {
	requireCall(getStartState, arguments);
	requireIntRange(1, players);

	var result = new CanadianState(players);
	for (var i = 0; i < players; i++) {
		result.time[i] = this.time;
		result.nextMoves[i] = this.movesPerPeriod;
	}
	return result;
});

method(function used(state, player, duration, finished) {
	requireCall(used, arguments);
	requireClass(state, CanadianState);
	requireTrue(player in state.time);
	requireIntRange(0, duration);
	requireBoolean(finished);

	var result = new CanadianState(state.players);
	for (var i = 0; i < state.players; i++) {
		result.time[i] = state.time[i];
		result.moves[i] = state.moves[i];
		result.nextMoves[i] = state.nextMoves[i];
	}

	var time = result.time[player];
	var moves = result.moves[player];
	var nextMoves = result.nextMoves[player];
	var rest = duration;

	if (rest > time) {
		rest -= time;
		time = 0;
	} else {
		time -= rest;
		rest = 0;
	}

	if (rest > 0 && moves === undefined) {
		time = this.timePerPeriod;
		moves = nextMoves;
		nextMoves += this.movesDelta;

		if (rest > time) {
			rest -= time;
			time = 0;
		} else {
			time -= rest;
			rest = 0;
		}
	}

	if (rest > 0)
		time = -1;

	if (rest == 0 && finished && moves !== undefined) {
		moves--;
		if (moves == 0) {
			time = this.timePerPeriod;
			moves = nextMoves;
			nextMoves += this.movesDelta;
		}
	}

	result.time[player] = time;
	result.moves[player] = moves;
	result.nextMoves[player] = nextMoves;

	return result;
});

method(function displayTime(state, player) {
	requireCall(displayTime, arguments);
	requireClass(state, CanadianState);
	V(player);
	requireTrue(player in state.time);
	requireFalse(this.hasLost(state, player));

	var time = state.time[player];
	var moves = state.moves[player];
	var nextMoves = state.nextMoves[player];

	var info = formatTime(time);
	if (moves !== undefined)
		info += '/' + moves;
	info += ' + ';
	info += formatTime(this.timePerPeriod) + '/' + nextMoves;
	return info;
});

method(function hasLost(state, player) {
	requireCall(hasLost, arguments);
	requireClass(state, CanadianState);
	requireTrue(player in state.time);

	return state.time[player] < 0;
});


/*
 * Unit Tests
 */

function testUtils() {
	V(0);
	requireEquals('00', twoDigits(0));
	requireEquals('123', twoDigits(123));

	var sd = new SuddenDeath('10:00');
	V(sd);
	requireTrue('className' in sd);
	requireClass(sd, SuddenDeath);
	requireClass(new Fischer('10:00', '00:10'), Fischer);
}

function testClock() {
	var clock = new Clock(1, new SuddenDeath('10:00'));
	requireEquals('stopped', clock.status);
	clock.start(0);
	requireEquals('running', clock.status);
	clock.pause();
	requireEquals('paused', clock.status);
	clock.cont();
	requireEquals('running', clock.status);
	clock.finishMove();
	requireEquals('stopped', clock.status);
}

function testSuddenDeath() {
	var sd = new SuddenDeath('10:00');
	var s00_00f = sd.getStartState(2);
	var s01_00f = sd.used(s00_00f, 0, parseTime('01:00'), true);
	var s05_00f = sd.used(s00_00f, 0, parseTime('05:00'), true);
	var s05_00f_2 = sd.used(s00_00f, 1, parseTime('05:00'), true);
	var s09_00f = sd.used(s00_00f, 0, parseTime('09:00'), true);
	var s10_00f = sd.used(s00_00f, 0, parseTime('10:00'), true);
	var s11_00f = sd.used(s00_00f, 0, parseTime('11:00'), true);

	requireEquals('10:00', sd.displayTime(s00_00f, 0));
	requireEquals('05:00', sd.displayTime(s05_00f, 0));
	requireEquals('00:00', sd.displayTime(s10_00f, 0));
	requireEquals('10:00', sd.displayTime(s00_00f, 1));
	requireEquals('10:00', sd.displayTime(s05_00f, 1));
	requireEquals('10:00', sd.displayTime(s10_00f, 1));
	requireEquals('10:00', sd.displayTime(s05_00f_2, 0));
	requireEquals('05:00', sd.displayTime(s05_00f_2, 1));

	requireFalse(sd.hasLost(s09_00f, 0));
	requireFalse(sd.hasLost(s10_00f, 0));
	requireTrue(sd.hasLost(s11_00f, 0));
}

function testHourGlass() {
	var hg = new HourGlass('10:00');
	var s0 = hg.getStartState(2);
	var s1 = hg.used(s0, 0, parseTime('01:00'), false);
	var s2 = hg.used(s1, 1, parseTime('03:00'), false);
	var s11_00u = hg.used(s0, 0, parseTime('11:00'), false);
	var s11_00f = hg.used(s0, 0, parseTime('11:00'), false);

	requireClass(hg, HourGlass);
	requireEquals('10:00', hg.displayTime(s0, 0));
	requireEquals('10:00', hg.displayTime(s0, 1));
	requireEquals('09:00', hg.displayTime(s1, 0));
	requireEquals('11:00', hg.displayTime(s1, 1));
	requireEquals('12:00', hg.displayTime(s2, 0));
	requireEquals('08:00', hg.displayTime(s2, 1));

	var s7 = hg.getStartState(8);
	var s7a = hg.used(s7, 0, parseTime('07:00'), false);
	requireEquals('03:00', hg.displayTime(s7a, 0));
	requireEquals('11:00', hg.displayTime(s7a, 1));
	requireEquals('11:00', hg.displayTime(s7a, 2));
	requireEquals('11:00', hg.displayTime(s7a, 3));
	requireEquals('11:00', hg.displayTime(s7a, 4));
	requireEquals('11:00', hg.displayTime(s7a, 5));
	requireEquals('11:00', hg.displayTime(s7a, 6));

	var timedOut = hg.used(s7, 3, parseTime('100:00'), false);
	requireEquals('11:25', hg.displayTime(timedOut, 0));
	requireEquals('11:25', hg.displayTime(timedOut, 1));
	requireEquals('11:25', hg.displayTime(timedOut, 2));
	requireEquals(true, hg.hasLost(timedOut, 3));
	requireEquals('11:25', hg.displayTime(timedOut, 4));
	requireEquals('11:25', hg.displayTime(timedOut, 5));
	requireEquals('11:25', hg.displayTime(timedOut, 6));

	requireTrue(hg.hasLost(s11_00u, 0));
	requireFalse(hg.hasLost(s11_00u, 1));
}

function testFischer() {
	var fischer = new Fischer('03:00', '00:10');
	var startf = fischer.getStartState(2);
	var move0u = fischer.used(startf, 0, parseTime('00:00'), false);
	var move0f = fischer.used(startf, 0, parseTime('00:00'), true);
	var move1u = fischer.used(startf, 0, parseTime('00:15'), false);
	var move1f = fischer.used(startf, 0, parseTime('00:15'), true);
	var move2u = fischer.used(move1f, 1, parseTime('00:17'), false);
	var move2f = fischer.used(move1f, 1, parseTime('00:17'), true);
	var move3u = fischer.used(move2f, 0, parseTime('00:03'), false);
	var move3f = fischer.used(move2f, 0, parseTime('00:03'), true);
	var s03_00u = fischer.used(startf, 0, parseTime('03:00'), false);
	var s03_05u = fischer.used(startf, 0, parseTime('03:05'), false);
	var s03_05f = fischer.used(startf, 0, parseTime('03:05'), true);
	var s04_00f = fischer.used(startf, 0, parseTime('04:00'), true);

	requireEquals('03:00', fischer.displayTime(startf, 0));
	requireEquals('03:00', fischer.displayTime(startf, 1));
	requireEquals('03:00', fischer.displayTime(move0u, 0));
	requireEquals('03:10', fischer.displayTime(move0f, 0));
	requireEquals('02:45', fischer.displayTime(move1u, 0));
	requireEquals('02:55', fischer.displayTime(move1f, 0));
	requireEquals('02:43', fischer.displayTime(move2u, 1));
	requireEquals('02:53', fischer.displayTime(move2f, 1));
	requireEquals('02:52', fischer.displayTime(move3u, 0));
	requireEquals('03:02', fischer.displayTime(move3f, 0));

	requireFalse(fischer.hasLost(s03_00u, 0));
	requireTrue(fischer.hasLost(s03_05u, 0));
	requireTrue(fischer.hasLost(s03_05f, 0));
	requireTrue(fischer.hasLost(s04_00f, 0));
}

function testCappedFischer() {
	var fischer = new CappedFischer('03:00', '00:10', '03:01');
	var startf = fischer.getStartState(2);
	var move0u = fischer.used(startf, 0, parseTime('00:00'), false);
	var move0f = fischer.used(startf, 0, parseTime('00:00'), true);
	var move1u = fischer.used(startf, 0, parseTime('00:15'), false);
	var move1f = fischer.used(startf, 0, parseTime('00:15'), true);
	var move2u = fischer.used(move1f, 1, parseTime('00:17'), false);
	var move2f = fischer.used(move1f, 1, parseTime('00:17'), true);
	var move3u = fischer.used(move2f, 0, parseTime('00:03'), false);
	var move3f = fischer.used(move2f, 0, parseTime('00:03'), true);
	var s03_00u = fischer.used(startf, 0, parseTime('03:00'), false);
	var s03_05u = fischer.used(startf, 0, parseTime('03:05'), false);
	var s03_05f = fischer.used(startf, 0, parseTime('03:05'), true);
	var s04_00f = fischer.used(startf, 0, parseTime('04:00'), true);

	requireEquals('03:00', fischer.displayTime(startf, 0));
	requireEquals('03:00', fischer.displayTime(startf, 1));
	requireEquals('03:00', fischer.displayTime(move0u, 0));
	requireEquals('03:01', fischer.displayTime(move0f, 0));
	requireEquals('02:45', fischer.displayTime(move1u, 0));
	requireEquals('02:55', fischer.displayTime(move1f, 0));
	requireEquals('02:43', fischer.displayTime(move2u, 1));
	requireEquals('02:53', fischer.displayTime(move2f, 1));
	requireEquals('02:52', fischer.displayTime(move3u, 0));
	requireEquals('03:01', fischer.displayTime(move3f, 0));

	requireFalse(fischer.hasLost(s03_00u, 0));
	requireTrue(fischer.hasLost(s03_05u, 0));
	requireTrue(fischer.hasLost(s03_05f, 0));
	requireTrue(fischer.hasLost(s04_00f, 0));
}

function testBronstein() {
	var ts = new Bronstein('25:00', '00:30');
	var s00_00f = ts.getStartState(1);
	var s00_00u = ts.used(s00_00f, 0, 0, false);
	var s00_29u = ts.used(s00_00f, 0, parseTime('00:29'), false);
	var s00_29f = ts.used(s00_00f, 0, parseTime('00:29'), true);
	var s01_30u = ts.used(s00_00f, 0, parseTime('01:30'), false);
	var s01_30f = ts.used(s00_00f, 0, parseTime('01:30'), true);
	var s01_30u2u = ts.used(s01_30f, 0, parseTime('00:20'), false);
	var s02_05f = ts.used(s01_30f, 0, parseTime('01:05'), true);
	var s25_31u = ts.used(s00_00f, 0, parseTime('25:31'), false);
	var s25_31u = ts.used(s00_00f, 0, parseTime('25:31'), false);

	requireEquals('25:00', ts.displayTime(s00_00f, 0));
	requireEquals('25:00 + 00:30', ts.displayTime(s00_00u, 0));
	requireEquals('25:00 + 00:01', ts.displayTime(s00_29u, 0));
	requireEquals('25:00', ts.displayTime(s00_29f, 0));
	requireEquals('24:00', ts.displayTime(s01_30u, 0));
	requireEquals('24:00', ts.displayTime(s01_30f, 0));
	requireEquals('24:00 + 00:10', ts.displayTime(s01_30u2u, 0));
	requireEquals('23:25', ts.displayTime(s02_05f, 0));

	requireTrue(ts.hasLost(s25_31u, 0));
}

function testByoyomi() {
	var ts = new Byoyomi('25:00', '00:30', 5);
	var s00_00f = ts.getStartState(1);
	var s24_59f = ts.used(s00_00f, 0, parseTime('24:59'), true);
	var s25_00f = ts.used(s00_00f, 0, parseTime('25:00'), true);
	var s25_10u = ts.used(s25_00f, 0, parseTime('00:10'), false);
	var s25_10f = ts.used(s25_00f, 0, parseTime('00:10'), true);
	var s25_10f_2u = ts.used(s25_10f, 0, parseTime('00:10'), false);
	var s25_10f_2f = ts.used(s25_10f, 0, parseTime('00:10'), true);
	var s27_10u = ts.used(s00_00f, 0, parseTime('27:10'), false);
	var s27_31u = ts.used(s00_00f, 0, parseTime('27:31'), false);
	var s27_31u = ts.used(s00_00f, 0, parseTime('27:31'), false);

	requireEquals('25:00 + 5 \xd7 00:30', ts.displayTime(s00_00f, 0));
	requireEquals('00:01 + 5 \xd7 00:30', ts.displayTime(s24_59f, 0));
	requireEquals('00:30 (5 \xd7 00:30)', ts.displayTime(s25_00f, 0));
	requireEquals('00:20 (5 \xd7 00:30)', ts.displayTime(s25_10u, 0));
	requireEquals('00:30 (5 \xd7 00:30)', ts.displayTime(s25_10f, 0));
	requireEquals('00:20 (5 \xd7 00:30)', ts.displayTime(s25_10f_2u, 0));
	requireEquals('00:30 (5 \xd7 00:30)', ts.displayTime(s25_10f_2f, 0));
	requireEquals('00:20 (SD)', ts.displayTime(s27_10u, 0));

	requireTrue(ts.hasLost(s27_31u, 0));
}

function testCanadian() {
	var ts = new Canadian('10:00', '01:00', 3, 0);
	var s00_00f = ts.getStartState(1);
	var s05_00u = ts.used(s00_00f, 0, parseTime('05:00'), false);
	var s05_00f = ts.used(s00_00f, 0, parseTime('05:00'), true);
	var s10_05u = ts.used(s05_00f, 0, parseTime('05:05'), false);
	var s10_05f = ts.used(s05_00f, 0, parseTime('05:05'), true);
	var s10_15u = ts.used(s10_05f, 0, parseTime('00:10'), false);
	var s10_15f = ts.used(s10_05f, 0, parseTime('00:10'), true);
	var s10_25u = ts.used(s10_15f, 0, parseTime('00:10'), false);
	var s10_25f = ts.used(s10_15f, 0, parseTime('00:10'), true);
	var s11_05u = ts.used(s10_15f, 0, parseTime('00:50'), false);
	var s11_05f = ts.used(s10_15f, 0, parseTime('00:50'), true);

	requireEquals('10:00 + 01:00/3', ts.displayTime(s00_00f, 0));
	requireEquals('05:00 + 01:00/3', ts.displayTime(s05_00u, 0));
	requireEquals('05:00 + 01:00/3', ts.displayTime(s05_00f, 0));
	requireEquals('00:55/3 + 01:00/3', ts.displayTime(s10_05u, 0));
	requireEquals('00:55/2 + 01:00/3', ts.displayTime(s10_05f, 0));
	requireEquals('00:45/2 + 01:00/3', ts.displayTime(s10_15u, 0));
	requireEquals('00:45/1 + 01:00/3', ts.displayTime(s10_15f, 0));
	requireEquals('00:35/1 + 01:00/3', ts.displayTime(s10_25u, 0));
	requireEquals('01:00/3 + 01:00/3', ts.displayTime(s10_25f, 0));
	requireTrue(ts.hasLost(s11_05u, 0));
	requireTrue(ts.hasLost(s11_05f, 0));
}

function testProgressiveCanadian() {
	var ts = new Canadian('00:00', '01:00', 1, 5);
	var p00_00f = ts.getStartState(1);
	var p00_30f = ts.used(p00_00f, 0, 30 * SECOND, true);
	requireEquals('01:00/6 + 01:00/11', ts.displayTime(p00_30f, 0));
}

function runTests() {
	testUtils();
	testClock();
	testSuddenDeath();
	testHourGlass();
	testFischer();
	testCappedFischer();
	testBronstein();
	testByoyomi();
	testCanadian();
	testProgressiveCanadian();

	log('Successfully tested ' + requirements + ' requirements.');
}

runTests();

return {
	Clock: Clock,
	TimeSystem: TimeSystem,
	SuddenDeath: SuddenDeath,
	HourGlass: HourGlass,
	Fischer: Fischer,
	CappedFischer: CappedFischer,
	Bronstein: Bronstein,
	Byoyomi: Byoyomi,
	Canadian: Canadian
};

})();

