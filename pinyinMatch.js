(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.pinyinMatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'v']);
    const INITIAL_STARTS = new Set(['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']);

    function hasVowelSoon(s, fromIndex) {
        const end = Math.min(s.length, fromIndex + 5);
        for (let i = fromIndex; i < end; i++) {
            if (VOWELS.has(s[i])) return true;
        }
        return false;
    }

    function isDigraphSecondChar(s, i) {
        if (i <= 0) return false;
        if (s[i] !== 'h') return false;
        const prev = s[i - 1];
        return prev === 's' || prev === 'z' || prev === 'c';
    }

    function isSyllableStartCandidate(s, i) {
        const ch = s[i];
        if (!INITIAL_STARTS.has(ch)) return false;
        if (isDigraphSecondChar(s, i)) return false;
        if (!hasVowelSoon(s, i)) return false;
        return true;
    }

    function getInitialism(s) {
        if (!s) return '';
        let out = s[0];
        for (let i = 1; i < s.length; i++) {
            if (isSyllableStartCandidate(s, i)) {
                out += s[i];
            }
        }
        return out;
    }

    function getSubsequenceInfo(query, target) {
        let qi = 0;
        let firstIndex = -1;
        let lastIndex = -1;

        for (let ti = 0; ti < target.length && qi < query.length; ti++) {
            if (target[ti] === query[qi]) {
                if (firstIndex === -1) firstIndex = ti;
                lastIndex = ti;
                qi++;
            }
        }

        if (qi !== query.length) {
            return { matched: false, span: Infinity, gaps: Infinity, firstIndex: Infinity };
        }

        const span = lastIndex - firstIndex;
        const gaps = span - (query.length - 1);
        return { matched: true, span, gaps, firstIndex };
    }

    function getPinyinCandidates(buffer, dict, options) {
        if (!buffer) return [];
        const opts = options && typeof options === 'object' ? options : {};
        const keyPriority = opts.keyPriority && typeof opts.keyPriority === 'object' ? opts.keyPriority : null;

        const keys = Object.keys(dict);
        const rankedKeys = [];

        const bufferFirst = buffer[0];
        const isInitialQuery = !buffer.split('').some(ch => VOWELS.has(ch));
        const hasExact = !!dict[buffer];
        const allowPrefix = buffer.length >= 1 || !hasExact;
        const allowInitials = isInitialQuery && buffer.length >= 2 && buffer.length <= 4;
        const allowSubsequence = isInitialQuery && buffer.length >= 2 && buffer.length <= 4;

        if (dict[buffer]) {
            const priority = keyPriority && typeof keyPriority[buffer] === 'number' ? keyPriority[buffer] : 0;
            rankedKeys.push({ key: buffer, type: 0, score: 0, priority });
        }

        if (allowPrefix) {
            for (const key of keys) {
                if (key === buffer) continue;
                if (key[0] !== bufferFirst) continue;
                if (key.startsWith(buffer)) {
                    const priority = keyPriority && typeof keyPriority[key] === 'number' ? keyPriority[key] : 0;
                    rankedKeys.push({ key, type: 1, score: key.length, priority });
                }
            }
        }

        if (allowInitials) {
            for (const key of keys) {
                if (key === buffer) continue;
                if (key[0] !== bufferFirst) continue;
                if (key.startsWith(buffer)) continue;

                const initials = getInitialism(key);
                if (initials && initials.startsWith(buffer)) {
                    const priority = keyPriority && typeof keyPriority[key] === 'number' ? keyPriority[key] : 0;
                    const initialsExtra = Math.max(0, initials.length - buffer.length);
                    rankedKeys.push({
                        key,
                        type: 2,
                        score: (initials === buffer ? 0 : 200) + initialsExtra * 50 + key.length,
                        priority
                    });
                }
            }
        }

        if (allowSubsequence) {
            for (const key of keys) {
                if (key === buffer) continue;
                if (key[0] !== bufferFirst) continue;
                if (key.startsWith(buffer)) continue;

                const initials = getInitialism(key);
                if (initials && initials.startsWith(buffer)) continue;

                const info = getSubsequenceInfo(buffer, key);
                if (!info.matched) continue;
                if (info.firstIndex > 0) continue;

                const priority = keyPriority && typeof keyPriority[key] === 'number' ? keyPriority[key] : 0;
                rankedKeys.push({
                    key,
                    type: 3,
                    score: info.span * 120 + info.gaps * 20 + key.length,
                    priority
                });
            }
        }

        rankedKeys.sort((a, b) => {
            if (a.type !== b.type) return a.type - b.type;
            if (a.priority !== b.priority) return b.priority - a.priority;
            if (a.score !== b.score) return a.score - b.score;
            return a.key.localeCompare(b.key);
        });

        const seen = new Set();
        const out = [];

        for (const item of rankedKeys) {
            const chars = dict[item.key];
            if (!Array.isArray(chars)) continue;
            for (const ch of chars) {
                if (seen.has(ch)) continue;
                seen.add(ch);
                out.push(ch);
            }
        }

        return out;
    }

    return { getPinyinCandidates };
});

