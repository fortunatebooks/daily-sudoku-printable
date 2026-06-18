const DEFAULT_SUDOKU_CONFIG = {
  startDate: '2026-06-18',
  seedVersion: 1,
  override: {
    enabled: false,
    puzzles: ['fiendish', 'super-fiendish']
  },
  schedule: {
    weekdays: ['very-difficult', 'fiendish'],
    weekends: ['fiendish', 'super-fiendish'],
    dates: {}
  },
  difficultyLevels: {
    medium: {
      label: 'medium',
      targetClues: 34,
      clueTargets: [34],
      minScore: 0,
      minHardestWeight: 0,
      minNonSingleSteps: 0,
      allowUnsolvedWithoutGuessing: false
    },
    'very-difficult': {
      label: 'Very Difficult',
      targetClues: 28,
      clueTargets: [28, 27, 29, 30],
      minScore: 55,
      minHardestWeight: 10,
      minNonSingleSteps: 1,
      allowUnsolvedWithoutGuessing: false
    },
    fiendish: {
      label: 'Fiendish',
      targetClues: 27,
      clueTargets: [27, 26, 28, 25],
      minScore: 78,
      minHardestWeight: 14,
      minNonSingleSteps: 3,
      allowUnsolvedWithoutGuessing: false
    },
    'super-fiendish': {
      label: 'Super Fiendish',
      targetClues: 26,
      clueTargets: [26, 25, 24, 27, 28],
      minScore: 105,
      minHardestWeight: 24,
      minNonSingleSteps: 4,
      allowUnsolvedWithoutGuessing: false
    }
  },
  grader: {
    maxGradedAttempts: 260,
    singleScoreCap: 20,
    techniqueWeights: {
      'naked-single': 1,
      'hidden-single': 2,
      'locked-candidate': 10,
      'naked-pair': 14,
      'hidden-pair': 16,
      'naked-triple': 24,
      'hidden-triple': 28,
      'x-wing': 38,
      'unsolved-without-guessing': 52
    }
  }
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_CONFIG = validateSudokuConfig(DEFAULT_SUDOKU_CONFIG);

export function getSudokuConfig() {
  return DEFAULT_CONFIG;
}

export function validateSudokuConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Sudoku config must be an object.');
  }

  validateDate(errors, config.startDate, 'startDate');
  if (!Number.isInteger(config.seedVersion) || config.seedVersion < 1) {
    errors.push('seedVersion must be a positive integer.');
  }

  const levels = config.difficultyLevels;
  if (!levels || typeof levels !== 'object' || Array.isArray(levels)) {
    errors.push('difficultyLevels must be an object.');
  } else {
    for (const [id, level] of Object.entries(levels)) {
      validateDifficultyLevel(errors, id, level);
    }
  }

  const knownIds = levels && typeof levels === 'object' ? new Set(Object.keys(levels)) : new Set();
  validateOverride(errors, config.override, knownIds);
  validateSchedule(errors, config.schedule, knownIds);
  validateGrader(errors, config.grader);

  if (errors.length > 0) {
    throw new TypeError(`Invalid Sudoku config:\n- ${errors.join('\n- ')}`);
  }

  return deepFreeze(cloneConfig(config));
}

function validateDifficultyLevel(errors, id, level) {
  if (!level || typeof level !== 'object' || Array.isArray(level)) {
    errors.push(`difficultyLevels.${id} must be an object.`);
    return;
  }

  if (typeof level.label !== 'string' || level.label.trim() === '') {
    errors.push(`difficultyLevels.${id}.label must be a non-empty string.`);
  }
  validateIntegerRange(errors, level.targetClues, `difficultyLevels.${id}.targetClues`, 17, 81);
  if (!Array.isArray(level.clueTargets) || level.clueTargets.length === 0) {
    errors.push(`difficultyLevels.${id}.clueTargets must be a non-empty array.`);
  } else {
    level.clueTargets.forEach((value, index) =>
      validateIntegerRange(errors, value, `difficultyLevels.${id}.clueTargets[${index}]`, 17, 81)
    );
  }
  validateNonNegativeInteger(errors, level.minScore, `difficultyLevels.${id}.minScore`);
  validateNonNegativeInteger(errors, level.minHardestWeight, `difficultyLevels.${id}.minHardestWeight`);
  validateNonNegativeInteger(errors, level.minNonSingleSteps, `difficultyLevels.${id}.minNonSingleSteps`);
  if (typeof level.allowUnsolvedWithoutGuessing !== 'boolean') {
    errors.push(`difficultyLevels.${id}.allowUnsolvedWithoutGuessing must be boolean.`);
  }
  if (
    level.minScore > 0 &&
    level.minHardestWeight === 0 &&
    level.minNonSingleSteps === 0
  ) {
    errors.push(`difficultyLevels.${id} has minScore but no hard-technique requirement.`);
  }
}

function validateOverride(errors, override, knownIds) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    errors.push('override must be an object.');
    return;
  }

  if (typeof override.enabled !== 'boolean') {
    errors.push('override.enabled must be boolean.');
  }
  validateDifficultyIdList(errors, override.puzzles, knownIds, 'override.puzzles');
}

function validateSchedule(errors, schedule, knownIds) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    errors.push('schedule must be an object.');
    return;
  }

  validateDifficultyIdList(errors, schedule.weekdays, knownIds, 'schedule.weekdays');
  validateDifficultyIdList(errors, schedule.weekends, knownIds, 'schedule.weekends');

  const dates = schedule.dates || {};
  if (typeof dates !== 'object' || Array.isArray(dates)) {
    errors.push('schedule.dates must be an object.');
    return;
  }

  for (const [dateIso, ids] of Object.entries(dates)) {
    validateDate(errors, dateIso, `schedule.dates.${dateIso}`);
    validateDifficultyIdList(errors, ids, knownIds, `schedule.dates.${dateIso}`);
  }
}

function validateGrader(errors, grader) {
  if (!grader || typeof grader !== 'object' || Array.isArray(grader)) {
    errors.push('grader must be an object.');
    return;
  }

  validateIntegerRange(errors, grader.maxGradedAttempts, 'grader.maxGradedAttempts', 1, 5000);
  validateNonNegativeInteger(errors, grader.singleScoreCap, 'grader.singleScoreCap');

  if (!grader.techniqueWeights || typeof grader.techniqueWeights !== 'object' || Array.isArray(grader.techniqueWeights)) {
    errors.push('grader.techniqueWeights must be an object.');
    return;
  }

  for (const [technique, weight] of Object.entries(grader.techniqueWeights)) {
    validateNonNegativeInteger(errors, weight, `grader.techniqueWeights.${technique}`);
  }
}

function validateDifficultyIdList(errors, ids, knownIds, path) {
  if (!Array.isArray(ids) || ids.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return;
  }

  ids.forEach((id, index) => {
    if (typeof id !== 'string' || !knownIds.has(id)) {
      errors.push(`${path}[${index}] must be a known difficulty id.`);
    }
  });
}

function validateDate(errors, value, path) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    errors.push(`${path} must be YYYY-MM-DD.`);
    return;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    errors.push(`${path} must be a real calendar date.`);
  }
}

function validateIntegerRange(errors, value, path, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${path} must be an integer between ${min} and ${max}.`);
  }
}

function validateNonNegativeInteger(errors, value, path) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${path} must be a non-negative integer.`);
  }
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
