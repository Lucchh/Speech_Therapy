// Progress Tracking System with Local Storage
// Duolingo-style reward system for speech therapy

// Speech Therapy Practice Scripts based on Forbrain methodology
// Organized by therapy type and sentence complexity
// Reference: https://www.forbrain.com/speech-therapy-for-kids/activities/speech-therapy-sentences/

const SPEECH_THERAPY_SCRIPTS = {
  stuttering: {
    simple: [
      { title: "Simple Sentence 1", text: "The cat sat." },
      { title: "Simple Sentence 2", text: "She runs fast." },
      { title: "Simple Sentence 3", text: "I see a dog." },
      { title: "Simple Sentence 4", text: "He is big." },
      { title: "Simple Sentence 5", text: "The sun is hot." },
      { title: "Simple Sentence 6", text: "We go up." },
      { title: "Simple Sentence 7", text: "It is cold." },
      { title: "Simple Sentence 8", text: "Mom is here." },
      { title: "Simple Sentence 9", text: "Dad is tall." },
      { title: "Simple Sentence 10", text: "I like cake." },
      { title: "Simple Sentence 11", text: "The bird sings." },
      { title: "Simple Sentence 12", text: "He can jump." },
      { title: "Simple Sentence 13", text: "I see you." },
      { title: "Simple Sentence 14", text: "We play now." },
      { title: "Simple Sentence 15", text: "The dog barks." },
      { title: "Simple Sentence 16", text: "She is nice." },
      { title: "Simple Sentence 17", text: "It is red." },
      { title: "Simple Sentence 18", text: "I am happy." },
      { title: "Simple Sentence 19", text: "You are funny." },
      { title: "Simple Sentence 20", text: "The ball rolls." },
      { title: "Simple Sentence 21", text: "We eat lunch." },
      { title: "Simple Sentence 22", text: "I have a toy." },
      { title: "Simple Sentence 23", text: "He is mad." },
      { title: "Simple Sentence 24", text: "The pig runs." },
      { title: "Simple Sentence 25", text: "She has a hat." },
      { title: "Simple Sentence 26", text: "I want that." },
      { title: "Simple Sentence 27", text: "Look at me." },
      { title: "Simple Sentence 28", text: "We can clap." },
      { title: "Simple Sentence 29", text: "The cow moos." },
      { title: "Simple Sentence 30", text: "I love you." }
    ],
    compound: [
      { title: "Compound Sentence 1", text: "I went to the store, and I bought milk." },
      { title: "Compound Sentence 2", text: "She likes apples, but he likes bananas." },
      { title: "Compound Sentence 3", text: "He wanted to play, so he finished his homework." },
      { title: "Compound Sentence 4", text: "I saw a dog, and it wagged its tail." },
      { title: "Compound Sentence 5", text: "She likes cake, but he likes pie." },
      { title: "Compound Sentence 6", text: "We went outside, and we played tag." },
      { title: "Compound Sentence 7", text: "He was tired, so he took a nap." },
      { title: "Compound Sentence 8", text: "I wanted juice, but we had milk." },
      { title: "Compound Sentence 9", text: "Mom cooked dinner, and Dad set the table." },
      { title: "Compound Sentence 10", text: "The sun came out, so we went to the park." },
      { title: "Compound Sentence 11", text: "I have a ball, and she has a kite." },
      { title: "Compound Sentence 12", text: "He fell down, but he got back up." },
      { title: "Compound Sentence 13", text: "I drew a cat, and she drew a dog." },
      { title: "Compound Sentence 14", text: "It was raining, so we stayed inside." },
      { title: "Compound Sentence 15", text: "She ran fast, but he ran faster." },
      { title: "Compound Sentence 16", text: "I ate my food, and then I had dessert." },
      { title: "Compound Sentence 17", text: "We sang songs, and we danced too." },
      { title: "Compound Sentence 18", text: "He wanted to play, so he cleaned his room." },
      { title: "Compound Sentence 19", text: "I love my bear, and I sleep with it." },
      { title: "Compound Sentence 20", text: "She found a rock, but it was not shiny." },
      { title: "Compound Sentence 21", text: "We went to the zoo, and we saw a lion." },
      { title: "Compound Sentence 22", text: "He is small, but he is strong." },
      { title: "Compound Sentence 23", text: "I read a book, and I liked it a lot." },
      { title: "Compound Sentence 24", text: "I saw a bird, and it flew away." },
      { title: "Compound Sentence 25", text: "She has a doll, and it has a pink dress." },
      { title: "Compound Sentence 26", text: "He ate lunch, but he was still hungry." },
      { title: "Compound Sentence 27", text: "I was sad, so I hugged my mom." },
      { title: "Compound Sentence 28", text: "I ran fast, but I didn't win the race." },
      { title: "Compound Sentence 29", text: "He smiled, and I smiled too." },
      { title: "Compound Sentence 30", text: "We made cookies, and we ate them all." }
    ],
    complex: [
      { title: "Complex Sentence 1", text: "Although it rained, we still played outside." },
      { title: "Complex Sentence 2", text: "When she laughs, I smile." },
      { title: "Complex Sentence 3", text: "If you see the bird, let me know." },
      { title: "Complex Sentence 4", text: "Because I was tired, I went to bed early." },
      { title: "Complex Sentence 5", text: "After we ate, we played a game." },
      { title: "Complex Sentence 6", text: "Before I go to school, I brush my teeth." },
      { title: "Complex Sentence 7", text: "While I was reading, the phone rang." },
      { title: "Complex Sentence 8", text: "Since it's sunny, we can go outside." },
      { title: "Complex Sentence 9", text: "Until you finish, you can't play." },
      { title: "Complex Sentence 10", text: "Wherever you go, I will follow." },
      { title: "Complex Sentence 11", text: "Whenever she calls, I answer." },
      { title: "Complex Sentence 12", text: "As soon as I finish, I'll help you." },
      { title: "Complex Sentence 13", text: "Even though it's hard, I'll try." },
      { title: "Complex Sentence 14", text: "So that I can learn, I study every day." },
      { title: "Complex Sentence 15", text: "In order to win, you must practice." },
      { title: "Complex Sentence 16", text: "Unless you hurry, you'll be late." },
      { title: "Complex Sentence 17", text: "Whether you like it or not, we're going." },
      { title: "Complex Sentence 18", text: "No matter what happens, I'll be here." },
      { title: "Complex Sentence 19", text: "As long as you try, you'll succeed." },
      { title: "Complex Sentence 20", text: "Provided that you study, you'll pass." },
      { title: "Complex Sentence 21", text: "In case it rains, bring an umbrella." },
      { title: "Complex Sentence 22", text: "Now that you're here, we can start." },
      { title: "Complex Sentence 23", text: "Once you understand, it's easy." },
      { title: "Complex Sentence 24", text: "The moment I saw it, I knew." },
      { title: "Complex Sentence 25", text: "By the time you arrive, I'll be ready." },
      { title: "Complex Sentence 26", text: "Every time I see you, I smile." },
      { title: "Complex Sentence 27", text: "The first time I tried, I failed." },
      { title: "Complex Sentence 28", text: "The last time we met, it was fun." },
      { title: "Complex Sentence 29", text: "Next time you come, bring a friend." },
      { title: "Complex Sentence 30", text: "This time, I'll do it right." }
    ]
  },
  phonological: {
    simple: [
      { title: "Articulation Practice 1", text: "The cat sat." },
      { title: "Articulation Practice 2", text: "She runs fast." },
      { title: "Articulation Practice 3", text: "I see a dog." },
      { title: "Articulation Practice 4", text: "He is big." },
      { title: "Articulation Practice 5", text: "The sun is hot." },
      { title: "Articulation Practice 6", text: "We go up." },
      { title: "Articulation Practice 7", text: "It is cold." },
      { title: "Articulation Practice 8", text: "Mom is here." },
      { title: "Articulation Practice 9", text: "Dad is tall." },
      { title: "Articulation Practice 10", text: "I like cake." },
      { title: "Articulation Practice 11", text: "The bird sings." },
      { title: "Articulation Practice 12", text: "He can jump." },
      { title: "Articulation Practice 13", text: "I see you." },
      { title: "Articulation Practice 14", text: "We play now." },
      { title: "Articulation Practice 15", text: "The dog barks." },
      { title: "Articulation Practice 16", text: "She is nice." },
      { title: "Articulation Practice 17", text: "It is red." },
      { title: "Articulation Practice 18", text: "I am happy." },
      { title: "Articulation Practice 19", text: "You are funny." },
      { title: "Articulation Practice 20", text: "The ball rolls." },
      { title: "Articulation Practice 21", text: "We eat lunch." },
      { title: "Articulation Practice 22", text: "I have a toy." },
      { title: "Articulation Practice 23", text: "He is mad." },
      { title: "Articulation Practice 24", text: "The pig runs." },
      { title: "Articulation Practice 25", text: "She has a hat." },
      { title: "Articulation Practice 26", text: "I want that." },
      { title: "Articulation Practice 27", text: "Look at me." },
      { title: "Articulation Practice 28", text: "We can clap." },
      { title: "Articulation Practice 29", text: "The cow moos." },
      { title: "Articulation Practice 30", text: "I love you." }
    ],
    compound: [
      { title: "Phonological Compound 1", text: "I went to the store, and I bought milk." },
      { title: "Phonological Compound 2", text: "She likes apples, but he likes bananas." },
      { title: "Phonological Compound 3", text: "He wanted to play, so he finished his homework." },
      { title: "Phonological Compound 4", text: "I saw a dog, and it wagged its tail." },
      { title: "Phonological Compound 5", text: "She likes cake, but he likes pie." },
      { title: "Phonological Compound 6", text: "We went outside, and we played tag." },
      { title: "Phonological Compound 7", text: "He was tired, so he took a nap." },
      { title: "Phonological Compound 8", text: "I wanted juice, but we had milk." },
      { title: "Phonological Compound 9", text: "Mom cooked dinner, and Dad set the table." },
      { title: "Phonological Compound 10", text: "The sun came out, so we went to the park." },
      { title: "Phonological Compound 11", text: "I have a ball, and she has a kite." },
      { title: "Phonological Compound 12", text: "He fell down, but he got back up." },
      { title: "Phonological Compound 13", text: "I drew a cat, and she drew a dog." },
      { title: "Phonological Compound 14", text: "It was raining, so we stayed inside." },
      { title: "Phonological Compound 15", text: "She ran fast, but he ran faster." },
      { title: "Phonological Compound 16", text: "I ate my food, and then I had dessert." },
      { title: "Phonological Compound 17", text: "We sang songs, and we danced too." },
      { title: "Phonological Compound 18", text: "He wanted to play, so he cleaned his room." },
      { title: "Phonological Compound 19", text: "I love my bear, and I sleep with it." },
      { title: "Phonological Compound 20", text: "She found a rock, but it was not shiny." },
      { title: "Phonological Compound 21", text: "We went to the zoo, and we saw a lion." },
      { title: "Phonological Compound 22", text: "He is small, but he is strong." },
      { title: "Phonological Compound 23", text: "I read a book, and I liked it a lot." },
      { title: "Phonological Compound 24", text: "I saw a bird, and it flew away." },
      { title: "Phonological Compound 25", text: "She has a doll, and it has a pink dress." },
      { title: "Phonological Compound 26", text: "He ate lunch, but he was still hungry." },
      { title: "Phonological Compound 27", text: "I was sad, so I hugged my mom." },
      { title: "Phonological Compound 28", text: "I ran fast, but I didn't win the race." },
      { title: "Phonological Compound 29", text: "He smiled, and I smiled too." },
      { title: "Phonological Compound 30", text: "We made cookies, and we ate them all." }
    ],
    complex: [
      { title: "Phonological Complex 1", text: "Although it rained, we still played outside." },
      { title: "Phonological Complex 2", text: "When she laughs, I smile." },
      { title: "Phonological Complex 3", text: "If you see the bird, let me know." },
      { title: "Phonological Complex 4", text: "Because I was tired, I went to bed early." },
      { title: "Phonological Complex 5", text: "After we ate, we played a game." },
      { title: "Phonological Complex 6", text: "Before I go to school, I brush my teeth." },
      { title: "Phonological Complex 7", text: "While I was reading, the phone rang." },
      { title: "Phonological Complex 8", text: "Since it's sunny, we can go outside." },
      { title: "Phonological Complex 9", text: "Until you finish, you can't play." },
      { title: "Phonological Complex 10", text: "Wherever you go, I will follow." },
      { title: "Phonological Complex 11", text: "Whenever she calls, I answer." },
      { title: "Phonological Complex 12", text: "As soon as I finish, I'll help you." },
      { title: "Phonological Complex 13", text: "Even though it's hard, I'll try." },
      { title: "Phonological Complex 14", text: "So that I can learn, I study every day." },
      { title: "Phonological Complex 15", text: "In order to win, you must practice." },
      { title: "Phonological Complex 16", text: "Unless you hurry, you'll be late." },
      { title: "Phonological Complex 17", text: "Whether you like it or not, we're going." },
      { title: "Phonological Complex 18", text: "No matter what happens, I'll be here." },
      { title: "Phonological Complex 19", text: "As long as you try, you'll succeed." },
      { title: "Phonological Complex 20", text: "Provided that you study, you'll pass." },
      { title: "Phonological Complex 21", text: "In case it rains, bring an umbrella." },
      { title: "Phonological Complex 22", text: "Now that you're here, we can start." },
      { title: "Phonological Complex 23", text: "Once you understand, it's easy." },
      { title: "Phonological Complex 24", text: "The moment I saw it, I knew." },
      { title: "Phonological Complex 25", text: "By the time you arrive, I'll be ready." },
      { title: "Phonological Complex 26", text: "Every time I see you, I smile." },
      { title: "Phonological Complex 27", text: "The first time I tried, I failed." },
      { title: "Phonological Complex 28", text: "The last time we met, it was fun." },
      { title: "Phonological Complex 29", text: "Next time you come, bring a friend." },
      { title: "Phonological Complex 30", text: "This time, I'll do it right." }
    ]
  }
};

// Training Plans Configuration
// Organized by therapy type (Stuttering/Phonological) and difficulty level (Simple/Compound/Complex)
// Based on Forbrain speech therapy methodology: https://www.forbrain.com/speech-therapy-for-kids/activities/speech-therapy-sentences/
const TRAINING_PLANS = {
  stuttering_simple: {
    name: "Stuttering - Simple Sentences",
    therapyType: "stuttering",
    difficulty: "simple",
    description: "Perfect for beginners working on stuttering. Practice short, simple sentences to improve fluency and build confidence. These sentences help bridge the gap between isolated sounds and fluent speech.",
    sessionsPerWeek: 3,
    minutesPerSession: 10,
    schedule: "Monday, Wednesday, Friday",
    xpPerSession: 50,
    weeklyGoal: 3,
    scripts: SPEECH_THERAPY_SCRIPTS.stuttering.simple,
    recommendation: "Recommended for: Beginners with stuttering, focusing on basic fluency patterns"
  },
  stuttering_compound: {
    name: "Stuttering - Compound Sentences",
    therapyType: "stuttering",
    difficulty: "compound",
    description: "Ideal for linking thoughts and practicing fluency. These sentences provide extra challenge for those wanting to boost fluency while mastering tricky sounds. Practice connecting ideas smoothly.",
    sessionsPerWeek: 4,
    minutesPerSession: 15,
    schedule: "Monday through Thursday",
    xpPerSession: 75,
    weeklyGoal: 4,
    scripts: SPEECH_THERAPY_SCRIPTS.stuttering.compound,
    recommendation: "Recommended for: Intermediate stuttering practice, improving connected speech"
  },
  stuttering_complex: {
    name: "Stuttering - Complex Sentences",
    therapyType: "stuttering",
    difficulty: "complex",
    description: "Great for advanced practice to boost grammar, fluency, and overall language skills. These sentences help build sophisticated speech patterns and improve natural conversation flow.",
    sessionsPerWeek: 5,
    minutesPerSession: 20,
    schedule: "Monday through Friday",
    xpPerSession: 100,
    weeklyGoal: 5,
    scripts: SPEECH_THERAPY_SCRIPTS.stuttering.complex,
    recommendation: "Recommended for: Advanced stuttering practice, natural conversation skills"
  },
  phonological_simple: {
    name: "Phonological - Simple Sentences",
    therapyType: "phonological",
    difficulty: "simple",
    description: "Perfect for beginners working on articulation and pronunciation. Practice individual sounds in clear, structured sentences. Focus on accurate sound production and clarity.",
    sessionsPerWeek: 3,
    minutesPerSession: 10,
    schedule: "Monday, Wednesday, Friday",
    xpPerSession: 50,
    weeklyGoal: 3,
    scripts: SPEECH_THERAPY_SCRIPTS.phonological.simple,
    recommendation: "Recommended for: Beginners with articulation issues, sound accuracy practice"
  },
  phonological_compound: {
    name: "Phonological - Compound Sentences",
    therapyType: "phonological",
    difficulty: "compound",
    description: "Ideal for improving pronunciation across connected speech. Practice articulating sounds accurately while linking thoughts together. Builds consistency in sound production.",
    sessionsPerWeek: 4,
    minutesPerSession: 15,
    schedule: "Monday through Thursday",
    xpPerSession: 75,
    weeklyGoal: 4,
    scripts: SPEECH_THERAPY_SCRIPTS.phonological.compound,
    recommendation: "Recommended for: Intermediate articulation practice, connected speech accuracy"
  },
  phonological_complex: {
    name: "Phonological - Complex Sentences",
    therapyType: "phonological",
    difficulty: "complex",
    description: "Advanced practice for precise articulation in complex sentence structures. Focus on maintaining sound accuracy while using sophisticated grammar patterns.",
    sessionsPerWeek: 5,
    minutesPerSession: 20,
    schedule: "Monday through Friday",
    xpPerSession: 100,
    weeklyGoal: 5,
    scripts: SPEECH_THERAPY_SCRIPTS.phonological.complex,
    recommendation: "Recommended for: Advanced articulation practice, precise pronunciation"
  }
};

// Achievement Definitions
const ACHIEVEMENTS = [
  { id: 'first_session', name: 'Getting Started', desc: 'Complete your first session', icon: '★', xp: 25 },
  { id: 'streak_3', name: 'On Fire', desc: '3 day streak', icon: '▲', xp: 50 },
  { id: 'streak_7', name: 'Week Warrior', desc: '7 day streak', icon: '◆', xp: 100 },
  { id: 'streak_30', name: 'Month Master', desc: '30 day streak', icon: '●', xp: 500 },
  { id: 'sessions_10', name: 'Dedicated', desc: 'Complete 10 sessions', icon: '★', xp: 100 },
  { id: 'sessions_50', name: 'Committed', desc: 'Complete 50 sessions', icon: '▲', xp: 500 },
  { id: 'sessions_100', name: 'Champion', desc: 'Complete 100 sessions', icon: '◆', xp: 1000 },
  { id: 'level_5', name: 'Rising Star', desc: 'Reach level 5', icon: '★', xp: 200 },
  { id: 'level_10', name: 'Expert', desc: 'Reach level 10', icon: '●', xp: 500 },
  { id: 'perfect_week', name: 'Perfect Week', desc: 'Complete all weekly goals', icon: '▲', xp: 150 }
];

// Initialize Progress Data
function initProgress() {
  if (!localStorage.getItem('avaProgress')) {
    const defaultProgress = {
      xp: 0,
      level: 1,
      streak: 0,
      lastSessionDate: null,
      totalSessions: 0,
      sessionsToday: 0,
      todayDate: new Date().toDateString(),
      selectedPlan: null,
      planStartDate: null,
      achievements: [],
      sessionHistory: []
    };
    localStorage.setItem('avaProgress', JSON.stringify(defaultProgress));
  }
  return JSON.parse(localStorage.getItem('avaProgress'));
}

// Get Progress Data
function getProgress() {
  return JSON.parse(localStorage.getItem('avaProgress'));
}

// Save Progress Data
function saveProgress(progress) {
  localStorage.setItem('avaProgress', JSON.stringify(progress));
}

// Calculate Level from XP
function calculateLevel(xp) {
  // Level formula: level = floor(sqrt(xp / 100)) + 1
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

// Calculate XP needed for next level
function xpForNextLevel(currentLevel) {
  const nextLevelXP = Math.pow(currentLevel, 2) * 100;
  const currentLevelXP = Math.pow(currentLevel - 1, 2) * 100;
  return nextLevelXP - currentLevelXP;
}

// Get current level progress
function getLevelProgress(xp, level) {
  const currentLevelXP = Math.pow(level - 1, 2) * 100;
  const nextLevelXP = Math.pow(level, 2) * 100;
  const progressXP = xp - currentLevelXP;
  const neededXP = nextLevelXP - currentLevelXP;
  return { progressXP, neededXP, percentage: (progressXP / neededXP) * 100 };
}

// Update Streak
function updateStreak(progress) {
  const today = new Date().toDateString();
  const lastDate = progress.lastSessionDate ? new Date(progress.lastSessionDate).toDateString() : null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  if (!lastDate) {
    // First session ever
    progress.streak = 1;
  } else if (lastDate === today) {
    // Already completed today, keep streak
    // Do nothing
  } else if (lastDate === yesterdayStr) {
    // Completed yesterday, continue streak
    progress.streak += 1;
  } else {
    // Streak broken
    progress.streak = 1;
  }

  progress.lastSessionDate = today;
  return progress;
}

// Award XP
function awardXP(amount, reason = 'Session completed') {
  const progress = getProgress();
  progress.xp += amount;
  
  const oldLevel = progress.level;
  progress.level = calculateLevel(progress.xp);
  
  // Check for level up
  if (progress.level > oldLevel) {
    showLevelUpNotification(progress.level);
    checkAchievements(progress);
  }
  
  saveProgress(progress);
  updateProgressUI();
  return progress;
}

// Check and unlock achievements
function checkAchievements(progress) {
  const unlocked = [];
  
  ACHIEVEMENTS.forEach(achievement => {
    if (progress.achievements.includes(achievement.id)) return;
    
    let shouldUnlock = false;
    
    switch(achievement.id) {
      case 'first_session':
        shouldUnlock = progress.totalSessions >= 1;
        break;
      case 'streak_3':
        shouldUnlock = progress.streak >= 3;
        break;
      case 'streak_7':
        shouldUnlock = progress.streak >= 7;
        break;
      case 'streak_30':
        shouldUnlock = progress.streak >= 30;
        break;
      case 'sessions_10':
        shouldUnlock = progress.totalSessions >= 10;
        break;
      case 'sessions_50':
        shouldUnlock = progress.totalSessions >= 50;
        break;
      case 'sessions_100':
        shouldUnlock = progress.totalSessions >= 100;
        break;
      case 'level_5':
        shouldUnlock = progress.level >= 5;
        break;
      case 'level_10':
        shouldUnlock = progress.level >= 10;
        break;
      case 'perfect_week':
        // Check if all weekly goals met (simplified - check last 7 days)
        shouldUnlock = checkPerfectWeek(progress);
        break;
    }
    
    if (shouldUnlock) {
      progress.achievements.push(achievement.id);
      unlocked.push(achievement);
      awardXP(achievement.xp, `Achievement: ${achievement.name}`);
    }
  });
  
  if (unlocked.length > 0) {
    showAchievementNotification(unlocked);
    saveProgress(progress);
    updateAchievementsUI();
  }
}

function checkPerfectWeek(progress) {
  // Simplified: check if user completed at least their weekly goal in last 7 days
  if (!progress.selectedPlan) return false;
  const plan = TRAINING_PLANS[progress.selectedPlan];
  const recentSessions = progress.sessionHistory.filter(s => {
    const sessionDate = new Date(s.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessionDate >= weekAgo;
  });
  return recentSessions.length >= plan.weeklyGoal;
}

// Record Session
function recordSession(mode, feedbackReceived = true) {
  const progress = getProgress();
  const today = new Date().toDateString();
  
  // Reset daily counter if new day
  if (progress.todayDate !== today) {
    progress.sessionsToday = 0;
    progress.todayDate = today;
  }
  
  // Update streak
  updateStreak(progress);
  
  // Increment counters
  progress.totalSessions += 1;
  progress.sessionsToday += 1;
  
  // Award XP based on plan
  let xpAmount = 50; // Default
  if (progress.selectedPlan && TRAINING_PLANS[progress.selectedPlan]) {
    xpAmount = TRAINING_PLANS[progress.selectedPlan].xpPerSession;
  }
  
  if (feedbackReceived) {
    awardXP(xpAmount, 'Session with feedback completed');
  }
  
  // Record session history
  progress.sessionHistory.push({
    date: new Date().toISOString(),
    mode: mode,
    xp: xpAmount
  });
  
  // Keep only last 100 sessions
  if (progress.sessionHistory.length > 100) {
    progress.sessionHistory = progress.sessionHistory.slice(-100);
  }
  
  saveProgress(progress);
  checkAchievements(progress);
  updateProgressUI();
  
  return progress;
}

// Set Training Plan
function setTrainingPlan(planId) {
  if (!TRAINING_PLANS[planId]) return;
  
  const progress = getProgress();
  progress.selectedPlan = planId;
  progress.planStartDate = new Date().toISOString();
  saveProgress(progress);
  
  updatePlanUI();
  return progress;
}

// Get Next Session Date
function getNextSessionDate(planId) {
  if (!planId || !TRAINING_PLANS[planId]) return null;
  
  const plan = TRAINING_PLANS[planId];
  const today = new Date();
  const progress = getProgress();
  
  // Simple logic: if sessions today < daily goal, next is today
  // Otherwise, next is tomorrow
  if (progress.sessionsToday < (plan.weeklyGoal / 7)) {
    return today.toLocaleDateString();
  }
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString();
}

// Update Progress UI
function updateProgressUI() {
  const progress = getProgress();
  
  // Update stats
  document.getElementById('streakCount').textContent = progress.streak;
  document.getElementById('xpCount').textContent = progress.xp;
  document.getElementById('levelCount').textContent = progress.level;
  document.getElementById('sessionsToday').textContent = progress.sessionsToday;
  
  // Update progress bar
  const levelProgress = getLevelProgress(progress.xp, progress.level);
  document.getElementById('xpProgress').textContent = `${levelProgress.progressXP} / ${levelProgress.neededXP} XP`;
  document.getElementById('xpProgressBar').style.width = `${Math.min(levelProgress.percentage, 100)}%`;
  
  // Update daily goal
  const dailyGoal = progress.selectedPlan && TRAINING_PLANS[progress.selectedPlan] 
    ? Math.ceil(TRAINING_PLANS[progress.selectedPlan].weeklyGoal / 7)
    : 1;
  document.getElementById('dailyGoalProgress').textContent = `${progress.sessionsToday} / ${dailyGoal} sessions`;
  const dailyPercentage = (progress.sessionsToday / dailyGoal) * 100;
  document.getElementById('dailyGoalBar').style.width = `${Math.min(dailyPercentage, 100)}%`;
}

// Update Plan UI
function updatePlanUI() {
  const progress = getProgress();
  const planSelect = document.getElementById('planSelect');
  const planDetails = document.getElementById('planDetails');
  const practiceScriptsSection = document.getElementById('practiceScriptsSection');
  const therapyTypeSelect = document.getElementById('therapyTypeSelect');
  const difficultySelect = document.getElementById('difficultySelect');
  const difficultySelector = document.getElementById('difficultySelector');
  
  if (progress.selectedPlan && TRAINING_PLANS[progress.selectedPlan]) {
    const plan = TRAINING_PLANS[progress.selectedPlan];
    
    // Update selectors to match selected plan
    if (therapyTypeSelect) {
      therapyTypeSelect.value = plan.therapyType;
    }
    if (difficultySelect) {
      difficultySelect.value = plan.difficulty;
      if (difficultySelector) {
        difficultySelector.style.display = 'block';
      }
    }
    if (planSelect) {
      planSelect.value = progress.selectedPlan;
    }
    
    document.getElementById('planTitle').textContent = plan.name;
    document.getElementById('planDescription').textContent = plan.description;
    document.getElementById('planSchedule').textContent = plan.schedule;
    document.getElementById('nextSessionDate').textContent = getNextSessionDate(progress.selectedPlan) || 'Today';
    
    // Add recommendation if available
    const recommendationEl = document.getElementById('planRecommendation');
    const recommendationTextEl = document.getElementById('planRecommendationText');
    if (recommendationEl && recommendationTextEl && plan.recommendation) {
      recommendationTextEl.textContent = plan.recommendation;
      recommendationEl.style.display = 'block';
    } else if (recommendationEl) {
      recommendationEl.style.display = 'none';
    }
    
    planDetails.style.display = 'block';
    
    // Display daily assigned sentences
    if (plan.scripts && plan.scripts.length > 0) {
      displayDailySentences(plan);
      practiceScriptsSection.style.display = 'block';
    } else {
      practiceScriptsSection.style.display = 'none';
    }
  } else {
    planDetails.style.display = 'none';
    if (practiceScriptsSection) {
      practiceScriptsSection.style.display = 'none';
    }
    if (difficultySelector) {
      difficultySelector.style.display = 'none';
    }
  }
}

// Get daily assigned sentences based on plan and session duration
function getDailySentences(plan) {
  if (!plan || !plan.scripts || plan.scripts.length === 0) return [];
  
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  
  // Determine number of sentences based on session duration
  let sentencesPerDay = 5; // Default
  if (plan.minutesPerSession <= 10) {
    sentencesPerDay = 5; // Simple sentences - 5 per 10 min session
  } else if (plan.minutesPerSession <= 15) {
    sentencesPerDay = 5; // Compound sentences - 5 per 15 min session
  } else {
    sentencesPerDay = 5; // Complex sentences - 5 per 20 min session
  }
  
  // Use day of year to cycle through sentences deterministically
  const startIndex = (dayOfYear * sentencesPerDay) % plan.scripts.length;
  const assignedSentences = [];
  
  for (let i = 0; i < sentencesPerDay; i++) {
    const index = (startIndex + i) % plan.scripts.length;
    assignedSentences.push(plan.scripts[index]);
  }
  
  return assignedSentences;
}

// Display daily assigned sentences
function displayDailySentences(plan) {
  const dailySentencesDiv = document.getElementById('dailySentences');
  if (!dailySentencesDiv) return;
  
  const assignedSentences = getDailySentences(plan);
  
  if (assignedSentences.length === 0) {
    dailySentencesDiv.innerHTML = '<p>No sentences assigned for today.</p>';
    return;
  }
  
  // Create a simple list of sentences
  let html = '<div class="sentences-list">';
  assignedSentences.forEach((sentence, index) => {
    html += `
      <div class="sentence-item">
        <span class="sentence-number">${index + 1}.</span>
        <span class="sentence-text">${sentence.text}</span>
      </div>
    `;
  });
  html += '</div>';
  
  dailySentencesDiv.innerHTML = html;
  
  // Store assigned sentences for use
  window.dailyAssignedSentences = assignedSentences;
}

// Update Achievements UI
function updateAchievementsUI() {
  const progress = getProgress();
  const achievementsGrid = document.getElementById('achievementsGrid');
  const achievementsSection = document.getElementById('achievementsSection');
  
  if (!achievementsGrid) return;
  
  achievementsGrid.innerHTML = '';
  
  ACHIEVEMENTS.forEach(achievement => {
    const isUnlocked = progress.achievements.includes(achievement.id);
    const badge = document.createElement('div');
    badge.className = `achievement-badge ${isUnlocked ? 'unlocked' : ''}`;
    badge.innerHTML = `
      <span class="achievement-icon">${achievement.icon}</span>
      <div class="achievement-name">${achievement.name}</div>
      <div class="achievement-desc">${achievement.desc}</div>
    `;
    achievementsGrid.appendChild(badge);
  });
  
  if (progress.achievements.length > 0) {
    achievementsSection.style.display = 'block';
  }
}

// Show Level Up Notification
function showLevelUpNotification(level) {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 2rem 3rem;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    text-align: center;
    animation: levelUpPulse 0.5s ease-out;
  `;
  notification.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 1rem; color: #fbbf24;">★</div>
    <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Level Up!</div>
    <div style="font-size: 2rem; font-weight: 800;">Level ${level}</div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Show Achievement Notification
function showAchievementNotification(achievements) {
  achievements.forEach((achievement, index) => {
    setTimeout(() => {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #22c55e 100%);
        color: white;
        padding: 1.5rem 2rem;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
      `;
      notification.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 0.5rem; color: #fbbf24;">${achievement.icon}</div>
        <div style="font-weight: 700; margin-bottom: 0.25rem;">Achievement Unlocked!</div>
        <div style="font-size: 1.125rem; font-weight: 600;">${achievement.name}</div>
        <div style="font-size: 0.875rem; margin-top: 0.5rem; opacity: 0.9;">+${achievement.xp} XP</div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }, index * 500);
  });
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes levelUpPulse {
    0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.1); }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initProgress();
  updateProgressUI();
  updatePlanUI();
  updateAchievementsUI();
  
  // Therapy type selector
  const therapyTypeSelect = document.getElementById('therapyTypeSelect');
  const difficultySelect = document.getElementById('difficultySelect');
  const difficultySelector = document.getElementById('difficultySelector');
  
  if (therapyTypeSelect) {
    therapyTypeSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        // Show difficulty selector when therapy type is selected
        if (difficultySelector) {
          difficultySelector.style.display = 'block';
        }
      } else {
        if (difficultySelector) {
          difficultySelector.style.display = 'none';
        }
        if (difficultySelect) {
          difficultySelect.value = '';
        }
      }
    });
  }
  
  // Difficulty selector - combines with therapy type to create plan ID
  if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
      if (therapyTypeSelect && therapyTypeSelect.value && e.target.value) {
        const planId = `${therapyTypeSelect.value}_${e.target.value}`;
        if (TRAINING_PLANS[planId]) {
          setTrainingPlan(planId);
        }
      }
    });
  }
  
  // Legacy plan selector (hidden, for backwards compatibility)
  const planSelect = document.getElementById('planSelect');
  if (planSelect) {
    planSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        setTrainingPlan(e.target.value);
      }
    });
  }
  
  // Use all sentences button - stores as ground truth for phonological mode
  const useAllSentencesBtn = document.getElementById('useAllSentencesBtn');
  if (useAllSentencesBtn) {
    useAllSentencesBtn.addEventListener('click', () => {
      if (window.dailyAssignedSentences && window.dailyAssignedSentences.length > 0) {
        // Store sentences as ground truth for phonological mode
        window.currentGroundTruthSentences = window.dailyAssignedSentences;
        // Show confirmation in status log
        const logEl = document.getElementById('log');
        if (logEl) {
          const msg = `Ground truth set: ${window.dailyAssignedSentences.length} sentences ready for phonological analysis.`;
          logEl.textContent = (logEl.textContent ? logEl.textContent + '\n' : '') + msg;
        }
        // Also update button to show it's been set
        useAllSentencesBtn.textContent = `✓ Ground Truth Set (${window.dailyAssignedSentences.length} sentences)`;
        useAllSentencesBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)';
      }
    });
  }
});

// Export functions and data for use in client.js
window.progressSystem = {
  recordSession,
  awardXP,
  getProgress,
  updateProgressUI,
  updatePlanUI,
  updateAchievementsUI
};

// Make TRAINING_PLANS accessible globally
window.TRAINING_PLANS = TRAINING_PLANS;

