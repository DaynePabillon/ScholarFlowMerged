export const belongsToGroup = (adviserRaw: string, user: any): boolean => {
    if (!adviserRaw) return false;
    const adviser = adviserRaw.toLowerCase().trim();
    const userNameRaw = String(user?.name || user?.fullName || user?.displayName || '').trim();
    const userName = userNameRaw.toLowerCase();
    const userEmail = String(user?.email || '').toLowerCase().trim();

    // If adviser string contains an email, require exact email match
    const emailMatch = adviserRaw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    if (emailMatch && userEmail) {
        if (emailMatch[0].toLowerCase() === userEmail) return true;
    }

    // Exact full-name match or adviser contains full name
    if (userName) {
        if (adviser === userName) return true;
        if (adviser.includes(userName)) return true;

        // Match on individual name tokens (word boundaries)
        const nameTokens = userName.split(/\s+/).filter(Boolean);
        const adviserTokens = adviser.split(/\W+/).filter(Boolean);
        for (const t of nameTokens) {
            if (t && adviserTokens.includes(t)) return true;
        }
    }

    // Fallback: match local-part of email (before @)
    if (userEmail) {
        const local = userEmail.split('@')[0];
        if (local && adviser.includes(local)) return true;
    }

    return false;
};
