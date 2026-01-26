const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const QUESTIONS_ROOT = path.join(PROJECT_ROOT, 'public', 'questions');
const EXPLANATIONS_ROOT = path.join(PROJECT_ROOT, 'public', 'explanations');
const DATA_PATH = path.join(PROJECT_ROOT, 'public', 'data', 'questions.json');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const SUBJECTIVE_KEYWORDS = ['주관식', '단답', '서술', 'short', 'essay', 'subjective'];
const B_FORM_SESSION = '1급-B형-샘플';

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function extractNumber(filename) {
  const match = filename.match(/(\d+)(?!.*\d)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function extractRange(filename) {
  const match = filename.match(/_(\d+)\s*~\s*(\d+)번/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
}

function parseArgs(argv) {
  const args = { subjectiveRanges: new Set(), forceType: false, forceBFormMap: false };
  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--subjective=')) {
      const value = raw.split('=')[1] || '';
      for (const part of value.split(',')) {
        if (!part.trim()) continue;
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (Number.isFinite(start) && Number.isFinite(end)) {
            const min = Math.min(start, end);
            const max = Math.max(start, end);
            for (let i = min; i <= max; i += 1) args.subjectiveRanges.add(i);
          }
        } else {
          const num = parseInt(part, 10);
          if (Number.isFinite(num)) args.subjectiveRanges.add(num);
        }
      }
    }
    if (raw === '--forceType=true') {
      args.forceType = true;
    }
    if (raw === '--forceBFormMap=true') {
      args.forceBFormMap = true;
    }
  }
  return args;
}

function hasKeyword(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return SUBJECTIVE_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function isSubjective({ pathParts, fileName, originalName, number, subjectiveRanges }) {
  if (subjectiveRanges && subjectiveRanges.has(number)) return true;
  if (hasKeyword(fileName) || hasKeyword(originalName)) return true;
  return pathParts.some((part) => hasKeyword(part));
}

function normalizeSlashes(p) {
  return p.split(path.sep).join('/');
}

function normalizeFilenameSpaces(name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const cleanedBase = base.replace(/\s+$/g, '');
  const cleanedExt = ext.replace(/\s+/g, '');
  return `${cleanedBase}${cleanedExt}`;
}

function removeSubjectiveSuffix(name) {
  return name.replace(/\(주관식\)/g, '');
}

async function listFilesRecursive(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFilesRecursive(fullPath);
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function getSetName(rootDir, filePath) {
  const relativeDir = path.relative(rootDir, path.dirname(filePath));
  const parts = relativeDir.split(path.sep).filter(Boolean);
  return parts[0] || null;
}

function getSetPathParts(rootDir, filePath) {
  const relativeDir = path.relative(rootDir, path.dirname(filePath));
  return relativeDir.split(path.sep).filter(Boolean);
}

function getSubdirKey(rootDir, setName, filePath) {
  const setDir = path.join(rootDir, setName);
  const relativeDir = path.relative(setDir, path.dirname(filePath));
  if (!relativeDir || relativeDir === '.') return '';
  return normalizeSlashes(relativeDir);
}

function isBFormForcedSubjective(setName, number) {
  return setName === B_FORM_SESSION && number >= 24 && number <= 30;
}

function isBFormQuestionMap(number) {
  if (number >= 24 && number <= 35) return true;
  return false;
}

function getBFormMapping(number) {
  if (number >= 24 && number <= 30) {
    return { type: 'subjective' };
  }
  if (number === 31) {
    return { type: 'multi', blanks: [31, 32, 33, 34, 35] };
  }
  if (number === 32) return { type: 'free' };
  if (number === 33) return { type: 'free' };
  if (number === 34) return { type: 'free', inputs: ['ㄱ', 'ㄴ'] };
  if (number === 35) return { type: 'free' };
  return null;
}

async function renameInRoot(rootDir, label, warnings, args) {
  const allFiles = await listFilesRecursive(rootDir);
  const results = {
    renamed: [],
    skipped: [],
    conflicted: [],
    failed: [],
    items: [],
  };

  for (const filePath of allFiles) {
    if (!isImageFile(filePath)) continue;

    const setName = getSetName(rootDir, filePath);
    if (!setName) {
      warnings.push(`[${label}] 세트명 추출 실패: ${path.relative(PROJECT_ROOT, filePath)}`);
      continue;
    }

    const fileName = path.basename(filePath);
    const range = extractRange(fileName);
    const number = range ? range.start : extractNumber(fileName);
    if (number === null) {
      warnings.push(`[${label}] 번호 추출 실패: ${path.relative(PROJECT_ROOT, filePath)}`);
      continue;
    }

    const pathParts = getSetPathParts(rootDir, filePath);
    const subjective = isSubjective({
      pathParts,
      fileName,
      originalName: fileName,
      number,
      subjectiveRanges: args.subjectiveRanges,
    });

    const ext = path.extname(fileName);

    let targetBase;
    const cleanedName = normalizeFilenameSpaces(fileName);

    if (range) {
      targetBase = `${setName}_${range.start}~${range.end}번`;
    } else if (setName === B_FORM_SESSION && label === 'explanations') {
      targetBase = `${setName}_${number}번`;
    } else if (setName === B_FORM_SESSION && label === 'questions' && isBFormForcedSubjective(setName, number)) {
      targetBase = `${setName}_${number}번(주관식)`;
    } else {
      targetBase = subjective ? `${setName}_${number}번(주관식)` : `${setName}_${number}번`;
    }

    const targetName = normalizeFilenameSpaces(`${targetBase}${ext}`);
    const sanitizedTargetName = setName === B_FORM_SESSION && label === 'explanations'
      ? removeSubjectiveSuffix(targetName)
      : targetName;
    const targetPath = path.join(path.dirname(filePath), sanitizedTargetName);

    const relativePath = normalizeSlashes(path.relative(rootDir, targetPath));
    const subdirKey = getSubdirKey(rootDir, setName, targetPath);

    if (path.resolve(filePath) === path.resolve(targetPath) && cleanedName === fileName) {
      results.skipped.push(`${path.relative(PROJECT_ROOT, filePath)} (already named)`);
      results.items.push({
        filePath,
        relativePath: normalizeSlashes(path.relative(rootDir, filePath)),
        setName,
        subdirKey,
        number,
        rangeStart: range ? range.start : null,
        rangeEnd: range ? range.end : null,
        isRange: Boolean(range),
        ext,
        fileName: sanitizedTargetName,
        originalName: fileName,
      });
      continue;
    }

    if (fs.existsSync(targetPath) && path.resolve(filePath) !== path.resolve(targetPath)) {
      results.conflicted.push(`${path.relative(PROJECT_ROOT, filePath)} -> ${path.relative(PROJECT_ROOT, targetPath)} (target exists)`);
      warnings.push(`[${label}] 대상 파일이 이미 존재하여 rename 스킵: ${path.relative(PROJECT_ROOT, targetPath)}`);
      results.items.push({
        filePath,
        relativePath: normalizeSlashes(path.relative(rootDir, filePath)),
        setName,
        subdirKey,
        number,
        rangeStart: range ? range.start : null,
        rangeEnd: range ? range.end : null,
        isRange: Boolean(range),
        ext,
        fileName: fileName,
        originalName: fileName,
      });
      continue;
    }

    try {
      await fsp.rename(filePath, targetPath);
      results.renamed.push(`${path.relative(PROJECT_ROOT, filePath)} -> ${path.relative(PROJECT_ROOT, targetPath)}`);
      results.items.push({
        filePath: targetPath,
        relativePath,
        setName,
        subdirKey,
        number,
        rangeStart: range ? range.start : null,
        rangeEnd: range ? range.end : null,
        isRange: Boolean(range),
        ext,
        fileName: sanitizedTargetName,
        originalName: fileName,
      });
    } catch (error) {
      results.failed.push(`${path.relative(PROJECT_ROOT, filePath)} -> ${path.relative(PROJECT_ROOT, targetPath)} (${error.message})`);
      warnings.push(`[${label}] rename 실패: ${path.relative(PROJECT_ROOT, filePath)} (${error.message})`);
      results.items.push({
        filePath,
        relativePath: normalizeSlashes(path.relative(rootDir, filePath)),
        setName,
        subdirKey,
        number,
        rangeStart: range ? range.start : null,
        rangeEnd: range ? range.end : null,
        isRange: Boolean(range),
        ext,
        fileName: fileName,
        originalName: fileName,
      });
    }
  }

  return results;
}

function buildIndex(items) {
  const index = new Map();
  for (const item of items) {
    if (item.isRange) continue;
    const setMap = index.get(item.setName) || new Map();
    const subdirMap = setMap.get(item.subdirKey) || new Map();
    const bucket = subdirMap.get(item.number) || [];
    bucket.push(item);
    subdirMap.set(item.number, bucket);
    setMap.set(item.subdirKey, subdirMap);
    index.set(item.setName, setMap);
  }
  return index;
}

function buildNumberIndex(items) {
  const index = new Map();
  for (const item of items) {
    if (item.isRange) continue;
    const setMap = index.get(item.setName) || new Map();
    const bucket = setMap.get(item.number) || [];
    bucket.push(item);
    setMap.set(item.number, bucket);
    index.set(item.setName, setMap);
  }
  return index;
}

function pickExplanation(setName, subdirKey, number, explainIndex, explainNumberIndex, explainRanges) {
  const setMap = explainIndex.get(setName);
  if (setMap) {
    const subdirMap = setMap.get(subdirKey);
    if (subdirMap) {
      const bucket = subdirMap.get(number);
      if (bucket && bucket.length > 0) return bucket[0];
    }
  }

  const numberMap = explainNumberIndex.get(setName);
  if (numberMap) {
    const bucket = numberMap.get(number) || [];
    if (bucket.length > 0) {
      bucket.sort((a, b) => (a.subdirKey < b.subdirKey ? -1 : 1));
      return bucket[0];
    }
  }

  if (Array.isArray(explainRanges)) {
    const candidates = explainRanges.filter(
      (item) =>
        item.setName === setName &&
        item.subdirKey === subdirKey &&
        item.rangeStart !== null &&
        item.rangeEnd !== null &&
        number >= item.rangeStart &&
        number <= item.rangeEnd
    );
    if (candidates.length > 0) return candidates[0];
  }

  return null;
}

async function readExistingQuestions(warnings) {
  try {
    const raw = await fsp.readFile(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      warnings.push('[questions.json] 배열이 아닙니다. 새로 생성합니다.');
      return [];
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    warnings.push(`[questions.json] 읽기 실패: ${error.message}. 새로 생성합니다.`);
    return [];
  }
}

async function writeQuestionsJson(questions) {
  const json = JSON.stringify(questions, null, 2);
  await fsp.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fsp.writeFile(DATA_PATH, json, 'utf8');
  return json;
}

function sortSetsAndNumbers(a, b) {
  if (a.setName < b.setName) return -1;
  if (a.setName > b.setName) return 1;
  return a.number - b.number;
}

function samplePaths(values, count = 3) {
  const list = values.filter(Boolean).slice(0, count);
  return list.length > 0 ? list.join(', ') : '없음';
}

function applyBFormMapping(entry, existing, force) {
  if (entry.setName !== B_FORM_SESSION) return null;
  if (!isBFormQuestionMap(entry.number)) return null;

  const mapping = getBFormMapping(entry.number);
  if (!mapping) return null;

  if (existing && !force) return null;

  return mapping;
}

async function main() {
  const args = parseArgs(process.argv);
  const warnings = [];
  const subjectiveLog = [];
  const bFormApplied = [];

  const questionResult = await renameInRoot(QUESTIONS_ROOT, 'questions', warnings, args);
  const explanationResult = await renameInRoot(EXPLANATIONS_ROOT, 'explanations', warnings, args);

  const questionRangeItems = questionResult.items.filter((item) => item.isRange);
  const explanationRangeItems = explanationResult.items.filter((item) => item.isRange);
  const questionIndex = buildIndex(questionResult.items);
  const explanationIndex = buildIndex(explanationResult.items);
  const explanationNumberIndex = buildNumberIndex(explanationResult.items);

  const setNames = Array.from(questionIndex.keys()).sort();
  const questionEntries = [];
  const explainMissing = [];
  const explainMatched = [];
  const perSetStats = new Map();

  for (const setName of setNames) {
    const setMap = questionIndex.get(setName) || new Map();

    let setQuestionCount = 0;
    let setExplainMatched = 0;

    for (const [subdirKey, subdirMap] of setMap.entries()) {
      const numbers = Array.from(subdirMap.keys()).sort((a, b) => a - b);

      for (const number of numbers) {
        const questionItems = subdirMap.get(number) || [];
        for (const questionItem of questionItems) {
          const explanationItem = pickExplanation(
            setName,
            subdirKey,
            number,
            explanationIndex,
            explanationNumberIndex,
            explanationRangeItems
          );

          let questionImage = `/questions/${questionItem.relativePath}`;
          let explainImage = explanationItem
            ? `/explanations/${explanationItem.relativePath}`
            : null;

          const pathParts = getSetPathParts(QUESTIONS_ROOT, questionItem.filePath);
          let subjective = isSubjective({
            pathParts,
            fileName: questionItem.fileName,
            originalName: questionItem.originalName,
            number,
            subjectiveRanges: args.subjectiveRanges,
          });

          if (setName === B_FORM_SESSION && isBFormForcedSubjective(setName, number)) {
            subjective = true;
          }

          if (subjective) {
            subjectiveLog.push(`${setName}_${number}번`);
          }

          if (explainImage) {
            explainMatched.push(`${setName}_${number}번`);
            setExplainMatched += 1;
          } else {
            explainMissing.push(`${setName}_${number}번`);
            warnings.push(`[explanations] 해설 누락: ${setName} ${number}번 (${subdirKey || 'root'})`);
          }

          questionEntries.push({
            id: `${setName}_${number}번`,
            setName,
            number,
            questionImage,
            explainImage,
            type: subjective ? 'subjective' : 'choice',
          });

          setQuestionCount += 1;
        }
      }
    }

    if (setName === B_FORM_SESSION) {
      const rangeItems = questionRangeItems.filter((item) => item.setName === setName);
      for (const rangeItem of rangeItems) {
        if (rangeItem.rangeStart === null || rangeItem.rangeEnd === null) continue;
        for (let n = rangeItem.rangeStart; n <= rangeItem.rangeEnd; n += 1) {
          const existingSubdir = setMap.get(rangeItem.subdirKey);
          if (existingSubdir && existingSubdir.has(n)) continue;

          const explanationItem = pickExplanation(
            setName,
            rangeItem.subdirKey,
            n,
            explanationIndex,
            explanationNumberIndex,
            explanationRangeItems
          );

          const questionImage = `/questions/${rangeItem.relativePath}`;
          const explainImage = explanationItem
            ? `/explanations/${explanationItem.relativePath}`
            : null;

          if (explainImage) {
            explainMatched.push(`${setName}_${n}번`);
            setExplainMatched += 1;
          } else {
            explainMissing.push(`${setName}_${n}번`);
            warnings.push(`[explanations] 해설 누락: ${setName} ${n}번 (${rangeItem.subdirKey || 'root'})`);
          }

          questionEntries.push({
            id: `${setName}_${n}번`,
            setName,
            number: n,
            questionImage,
            explainImage,
            type: 'choice',
          });

          setQuestionCount += 1;
        }
      }
    }

    perSetStats.set(setName, {
      questions: setQuestionCount,
      matched: setExplainMatched,
    });
  }

  const existingQuestions = await readExistingQuestions(warnings);
  const existingByQuestionImage = new Map();
  const existingById = new Map();
  for (const item of existingQuestions) {
    if (item && item.questionImage) {
      existingByQuestionImage.set(item.questionImage, item);
    }
    if (item && item.id) {
      existingById.set(item.id, item);
    }
  }

  const updatedQuestions = [];
  const missingFilesInJson = [];
  const questionImagesSet = new Set(questionEntries.map((entry) => entry.questionImage));

  for (const existing of existingQuestions) {
    if (existing && existing.questionImage && !questionImagesSet.has(existing.questionImage)) {
      missingFilesInJson.push(existing.questionImage);
    }
  }

  for (const entry of questionEntries.sort(sortSetsAndNumbers)) {
    const useIdLookup = entry.setName === B_FORM_SESSION && entry.number >= 31 && entry.number <= 35;
    const existing = useIdLookup
      ? existingById.get(entry.id)
      : existingByQuestionImage.get(entry.questionImage);
    const mapping = applyBFormMapping(entry, existing, args.forceBFormMap);

    if (existing) {
      if (args.forceType) {
        existing.type = entry.type;
      }
      if (mapping) {
        existing.type = mapping.type;
        if (mapping.inputs) existing.inputs = mapping.inputs;
        if (mapping.blanks) existing.blanks = mapping.blanks;
        bFormApplied.push(`${entry.id}:${mapping.type}`);
      }
      updatedQuestions.push(existing);
      continue;
    }

    const newItem = {
      id: entry.id,
      level: 1,
      sessionId: entry.setName,
      type: entry.type,
      questionImage: entry.questionImage,
      explainImage: entry.explainImage,
      answerIndex: 0,
    };

    if (mapping) {
      newItem.type = mapping.type;
      if (mapping.inputs) newItem.inputs = mapping.inputs;
      if (mapping.blanks) newItem.blanks = mapping.blanks;
      bFormApplied.push(`${entry.id}:${mapping.type}`);
    }

    updatedQuestions.push(newItem);
  }

  const jsonOutput = await writeQuestionsJson(updatedQuestions);

  console.log('=== Rename Results: Questions ===');
  questionResult.renamed.forEach((line) => console.log(`✔ ${line}`));
  questionResult.skipped.forEach((line) => console.log(`↷ ${line}`));
  questionResult.conflicted.forEach((line) => console.log(`⚠ ${line}`));
  questionResult.failed.forEach((line) => console.log(`✖ ${line}`));
  console.log('');

  console.log('=== Rename Results: Explanations ===');
  explanationResult.renamed.forEach((line) => console.log(`✔ ${line}`));
  explanationResult.skipped.forEach((line) => console.log(`↷ ${line}`));
  explanationResult.conflicted.forEach((line) => console.log(`⚠ ${line}`));
  explanationResult.failed.forEach((line) => console.log(`✖ ${line}`));
  console.log('');

  if (warnings.length > 0) {
    console.warn('=== Warnings ===');
    warnings.forEach((line) => console.warn(`! ${line}`));
    console.warn('');
  }

  if (args.subjectiveRanges.size > 0) {
    console.log('=== Subjective Range Option ===');
    console.log(`지정된 subjective 번호: ${Array.from(args.subjectiveRanges).sort((a, b) => a - b).join(', ')}`);
    console.log('');
  }

  console.log('=== questions.json ===');
  console.log(jsonOutput);
  console.log('');

  const questionPathSamples = questionEntries.map((q) => q.questionImage);
  const explainPathSamples = questionEntries.map((q) => q.explainImage).filter(Boolean);

  console.log('=== Samples ===');
  console.log(`questionImage 예시: ${samplePaths(questionPathSamples)}`);
  console.log(`explainImage 예시: ${samplePaths(explainPathSamples)}`);
  console.log('');

  console.log('=== Per-Set Summary ===');
  for (const [setName, stats] of perSetStats.entries()) {
    const rate = stats.questions > 0 ? `${stats.matched}/${stats.questions}` : '0/0';
    console.log(`- ${setName}: 문제 ${stats.questions}, 해설 매칭 ${rate}`);
  }
  console.log('');

  console.log('=== Summary ===');
  console.log(`처리한 세트명: ${setNames.length > 0 ? setNames.join(', ') : '없음'}`);
  console.log(`처리한 문제 파일 수: ${questionEntries.length}`);
  console.log(`rename 성공(문제): ${questionResult.renamed.length}`);
  console.log(`rename 스킵(문제): ${questionResult.skipped.length}`);
  console.log(`rename 충돌(문제): ${questionResult.conflicted.length}`);
  console.log(`rename 실패(문제): ${questionResult.failed.length}`);
  console.log(`rename 성공(해설): ${explanationResult.renamed.length}`);
  console.log(`rename 스킵(해설): ${explanationResult.skipped.length}`);
  console.log(`rename 충돌(해설): ${explanationResult.conflicted.length}`);
  console.log(`rename 실패(해설): ${explanationResult.failed.length}`);
  console.log(`해설 매칭 성공: ${explainMatched.length}`);
  console.log(`해설 매칭 실패: ${explainMissing.length}`);
  console.log(`explainImage=null 목록: ${explainMissing.length > 0 ? explainMissing.join(', ') : '없음'}`);
  console.log(`subjective 분류 목록: ${subjectiveLog.length > 0 ? subjectiveLog.join(', ') : '없음'}`);
  console.log(`JSON에 있으나 파일 없음: ${missingFilesInJson.length > 0 ? missingFilesInJson.join(', ') : '없음'}`);
  console.log(`B형 강제 매핑 적용: ${bFormApplied.length > 0 ? bFormApplied.join(', ') : '없음'}`);
  console.log('');

  console.log('=== Usage ===');
  console.log('node scripts/rename-and-generate.js');
  console.log('node scripts/rename-and-generate.js --subjective="24-26,30" --forceType=true --forceBFormMap=true');
  console.log('');

  if (subjectiveLog.length > 0) {
    console.log('※ subjective 문제는 answerIndex=0 유지(의미 없음)');
  }
}

main().catch((error) => {
  console.error('스크립트 실행 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});
