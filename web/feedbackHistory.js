// Feedback History Storage and Progress Report System

// Initialize feedback history storage
function initFeedbackHistory() {
  if (!localStorage.getItem('avaFeedbackHistory')) {
    localStorage.setItem('avaFeedbackHistory', JSON.stringify([]));
  }
}

// Save feedback to history
function saveFeedbackToHistory(feedbackData, metadata = {}) {
  initFeedbackHistory();
  const history = JSON.parse(localStorage.getItem('avaFeedbackHistory'));
  
  const feedbackEntry = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    mode: metadata.mode || 'unknown',
    feedback: feedbackData,
    metadata: {
      take: metadata.take || 0,
      target_script: metadata.target_script || null,
      intake_text: metadata.intake_text || null,
      audio_url: metadata.audio_url || null,
      assistant_transcript: metadata.assistant_transcript || null
    }
  };
  
  history.unshift(feedbackEntry); // Add to beginning
  
  // Keep only last 1000 feedback entries
  if (history.length > 1000) {
    history.splice(1000);
  }
  
  localStorage.setItem('avaFeedbackHistory', JSON.stringify(history));
  updateProgressReport();
  return feedbackEntry;
}

// Get feedback history
function getFeedbackHistory() {
  initFeedbackHistory();
  return JSON.parse(localStorage.getItem('avaFeedbackHistory'));
}

// Get filtered feedback history
function getFilteredFeedbackHistory(dateRange = 'all', modeFilter = 'all') {
  const history = getFeedbackHistory();
  const now = new Date();
  let filtered = [...history];
  
  // Filter by date range
  if (dateRange !== 'all') {
    const cutoffDate = new Date();
    switch (dateRange) {
      case 'week':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
      case '3months':
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        break;
    }
    filtered = filtered.filter(entry => new Date(entry.timestamp) >= cutoffDate);
  }
  
  // Filter by mode
  if (modeFilter !== 'all') {
    filtered = filtered.filter(entry => entry.mode === modeFilter);
  }
  
  return filtered;
}

// Generate report summary
function generateReportSummary(history) {
  if (history.length === 0) {
    return {
      totalSessions: 0,
      stutterSessions: 0,
      phonologicalSessions: 0,
      averageScores: null,
      improvementTrend: null,
      mostCommonIssues: [],
      mostCommonStrengths: []
    };
  }
  
  const stutterSessions = history.filter(h => h.mode === 'stutter');
  const phonologicalSessions = history.filter(h => h.mode === 'phonological');
  
  // Calculate average scores for phonological mode
  let avgPronunciation = null;
  let avgIntelligibility = null;
  const phonologicalWithScores = phonologicalSessions.filter(h => 
    h.feedback && h.feedback.scores
  );
  
  if (phonologicalWithScores.length > 0) {
    const totalPron = phonologicalWithScores.reduce((sum, h) => 
      sum + (h.feedback.scores.pronunciation || 0), 0);
    const totalIntel = phonologicalWithScores.reduce((sum, h) => 
      sum + (h.feedback.scores.intelligibility || 0), 0);
    avgPronunciation = Math.round(totalPron / phonologicalWithScores.length);
    avgIntelligibility = Math.round(totalIntel / phonologicalWithScores.length);
  }
  
  // Find most common issues and strengths
  const allIssues = [];
  const allStrengths = [];
  
  history.forEach(entry => {
    if (entry.feedback) {
      if (entry.feedback.areas_for_improvement) {
        allIssues.push(...entry.feedback.areas_for_improvement);
      }
      if (entry.feedback.strengths) {
        allStrengths.push(...entry.feedback.strengths);
      }
    }
  });
  
  // Count occurrences
  const issueCounts = {};
  const strengthCounts = {};
  
  allIssues.forEach(issue => {
    issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  });
  
  allStrengths.forEach(strength => {
    strengthCounts[strength] = (strengthCounts[strength] || 0) + 1;
  });
  
  const mostCommonIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count }));
  
  const mostCommonStrengths = Object.entries(strengthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([strength, count]) => ({ strength, count }));
  
  // Calculate improvement trend (compare first half vs second half)
  let improvementTrend = null;
  if (history.length >= 4) {
    const midpoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midpoint);
    const secondHalf = history.slice(midpoint);
    
    if (phonologicalWithScores.length >= 4) {
      const firstHalfScores = firstHalf
        .filter(h => h.feedback && h.feedback.scores)
        .map(h => (h.feedback.scores.pronunciation || 0) + (h.feedback.scores.intelligibility || 0));
      const secondHalfScores = secondHalf
        .filter(h => h.feedback && h.feedback.scores)
        .map(h => (h.feedback.scores.pronunciation || 0) + (h.feedback.scores.intelligibility || 0));
      
      if (firstHalfScores.length > 0 && secondHalfScores.length > 0) {
        const firstAvg = firstHalfScores.reduce((a, b) => a + b, 0) / firstHalfScores.length;
        const secondAvg = secondHalfScores.reduce((a, b) => a + b, 0) / secondHalfScores.length;
        improvementTrend = secondAvg > firstAvg ? 'improving' : secondAvg < firstAvg ? 'declining' : 'stable';
      }
    }
  }
  
  return {
    totalSessions: history.length,
    stutterSessions: stutterSessions.length,
    phonologicalSessions: phonologicalSessions.length,
    averageScores: {
      pronunciation: avgPronunciation,
      intelligibility: avgIntelligibility
    },
    improvementTrend,
    mostCommonIssues,
    mostCommonStrengths
  };
}

// Update progress report display
function updateProgressReport() {
  const dateRange = document.getElementById('reportDateRange')?.value || 'all';
  const modeFilter = document.getElementById('reportModeFilter')?.value || 'all';
  
  const filteredHistory = getFilteredFeedbackHistory(dateRange, modeFilter);
  const summary = generateReportSummary(filteredHistory);
  
  // Update summary
  const summaryEl = document.getElementById('reportSummary');
  if (summaryEl) {
    summaryEl.innerHTML = renderReportSummary(summary);
  }
  
  // Update history
  const historyEl = document.getElementById('reportHistory');
  if (historyEl) {
    historyEl.innerHTML = renderReportHistory(filteredHistory);
  }
}

// Render report summary
function renderReportSummary(summary) {
  if (summary.totalSessions === 0) {
    return '<p class="no-data">No feedback history yet. Complete some sessions to see your progress report.</p>';
  }
  
  let html = '<div class="summary-grid">';
  
  html += `
    <div class="summary-card">
      <div class="summary-value">${summary.totalSessions}</div>
      <div class="summary-label">Total Sessions</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${summary.stutterSessions}</div>
      <div class="summary-label">Stuttering Sessions</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${summary.phonologicalSessions}</div>
      <div class="summary-label">Phonological Sessions</div>
    </div>
  `;
  
  if (summary.averageScores && summary.averageScores.pronunciation !== null) {
    html += `
      <div class="summary-card">
        <div class="summary-value">${summary.averageScores.pronunciation}%</div>
        <div class="summary-label">Avg Pronunciation</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.averageScores.intelligibility}%</div>
        <div class="summary-label">Avg Intelligibility</div>
      </div>
    `;
  }
  
  html += '</div>';
  
  if (summary.improvementTrend) {
    const trendIcon = summary.improvementTrend === 'improving' ? '↑' : 
                     summary.improvementTrend === 'declining' ? '↓' : '→';
    const trendColor = summary.improvementTrend === 'improving' ? 'var(--success)' : 
                      summary.improvementTrend === 'declining' ? 'var(--warning)' : 'var(--text-muted)';
    html += `<div class="trend-indicator" style="color: ${trendColor};">Trend: ${trendIcon} ${summary.improvementTrend}</div>`;
  }
  
  if (summary.mostCommonIssues.length > 0) {
    html += '<div class="common-items"><strong>Most Common Areas for Improvement:</strong><ul>';
    summary.mostCommonIssues.forEach(({ issue, count }) => {
      html += `<li>${issue} (${count}x)</li>`;
    });
    html += '</ul></div>';
  }
  
  if (summary.mostCommonStrengths.length > 0) {
    html += '<div class="common-items"><strong>Most Common Strengths:</strong><ul>';
    summary.mostCommonStrengths.forEach(({ strength, count }) => {
      html += `<li>${strength} (${count}x)</li>`;
    });
    html += '</ul></div>';
  }
  
  return html;
}

// Render report history
function renderReportHistory(history) {
  if (history.length === 0) {
    return '<p class="no-data">No feedback entries found for the selected filters.</p>';
  }
  
  let html = '<div class="history-timeline">';
  
  history.forEach((entry, index) => {
    const feedback = entry.feedback;
    const isStutter = entry.mode === 'stutter';
    
    html += `
      <div class="history-entry">
        <div class="history-header">
          <div class="history-date">
            <strong>${entry.date}</strong> ${entry.time}
          </div>
          <div class="history-mode">
            ${isStutter ? 'Stuttering' : 'Phonological'}
          </div>
        </div>
        <div class="history-content">
    `;
    
    if (isStutter && feedback) {
      if (feedback.content_summary) {
        html += `<div class="history-summary"><strong>Topic:</strong> ${feedback.content_summary}</div>`;
      }
      if (feedback.overall_summary) {
        html += `<div class="history-summary">${feedback.overall_summary}</div>`;
      }
      if (feedback.strengths && feedback.strengths.length > 0) {
        html += '<div class="history-section"><strong>Strengths:</strong><ul>';
        feedback.strengths.forEach(s => html += `<li>${s}</li>`);
        html += '</ul></div>';
      }
      if (feedback.areas_for_improvement && feedback.areas_for_improvement.length > 0) {
        html += '<div class="history-section"><strong>Areas for Improvement:</strong><ul>';
        feedback.areas_for_improvement.forEach(a => html += `<li>${a}</li>`);
        html += '</ul></div>';
      }
    } else if (!isStutter && feedback) {
      if (feedback.content_summary) {
        html += `<div class="history-summary"><strong>Topic:</strong> ${feedback.content_summary}</div>`;
      }
      if (feedback.summary) {
        html += `<div class="history-summary">${feedback.summary}</div>`;
      }
      if (feedback.scores) {
        html += `
          <div class="history-scores">
            <strong>Scores:</strong>
            Pronunciation: ${feedback.scores.pronunciation || 'N/A'}% | 
            Intelligibility: ${feedback.scores.intelligibility || 'N/A'}%
          </div>
        `;
      }
      if (feedback.differences && feedback.differences.length > 0) {
        html += '<div class="history-section"><strong>Differences Found:</strong><ul>';
        feedback.differences.forEach(d => {
          html += `<li><strong>${d.type}:</strong> Expected "${d.reference}", heard "${d.observed}". ${d.note}</li>`;
        });
        html += '</ul></div>';
      }
    }
    
    if (feedback && feedback.practice_tips && feedback.practice_tips.length > 0) {
      html += '<div class="history-section"><strong>Practice Tips:</strong><ul>';
      feedback.practice_tips.forEach(tip => html += `<li>${tip}</li>`);
      html += '</ul></div>';
    }
    
    if (entry.metadata.intake_text) {
      html += `<div class="history-transcript"><strong>Transcript:</strong> ${entry.metadata.intake_text}</div>`;
    }
    
    html += `
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

// Export functions
function exportFeedbackHistoryJSON() {
  const history = getFeedbackHistory();
  const progress = window.progressSystem ? window.progressSystem.getProgress() : null;
  
  const exportData = {
    exportDate: new Date().toISOString(),
    userProgress: progress,
    feedbackHistory: history,
    summary: generateReportSummary(history)
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `speech-therapy-progress-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportFeedbackHistoryText() {
  const dateRange = document.getElementById('reportDateRange')?.value || 'all';
  const modeFilter = document.getElementById('reportModeFilter')?.value || 'all';
  const filteredHistory = getFilteredFeedbackHistory(dateRange, modeFilter);
  const summary = generateReportSummary(filteredHistory);
  const progress = window.progressSystem ? window.progressSystem.getProgress() : null;
  
  let text = 'SPEECH THERAPY PROGRESS REPORT\n';
  text += '='.repeat(50) + '\n\n';
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Date Range: ${dateRange}\n`;
  text += `Mode Filter: ${modeFilter}\n\n`;
  
  if (progress) {
    text += 'USER PROGRESS SUMMARY\n';
    text += '-'.repeat(50) + '\n';
    text += `Total XP: ${progress.xp}\n`;
    text += `Level: ${progress.level}\n`;
    text += `Day Streak: ${progress.streak}\n`;
    text += `Total Sessions: ${progress.totalSessions}\n\n`;
  }
  
  text += 'FEEDBACK SUMMARY\n';
  text += '-'.repeat(50) + '\n';
  text += `Total Sessions: ${summary.totalSessions}\n`;
  text += `Stuttering Sessions: ${summary.stutterSessions}\n`;
  text += `Phonological Sessions: ${summary.phonologicalSessions}\n`;
  
  if (summary.averageScores && summary.averageScores.pronunciation !== null) {
    text += `Average Pronunciation Score: ${summary.averageScores.pronunciation}%\n`;
    text += `Average Intelligibility Score: ${summary.averageScores.intelligibility}%\n`;
  }
  
  if (summary.improvementTrend) {
    text += `Improvement Trend: ${summary.improvementTrend}\n`;
  }
  
  text += '\n\nFEEDBACK HISTORY\n';
  text += '='.repeat(50) + '\n\n';
  
  filteredHistory.forEach((entry, index) => {
    text += `SESSION ${index + 1}\n`;
    text += '-'.repeat(50) + '\n';
    text += `Date: ${entry.date} ${entry.time}\n`;
    text += `Mode: ${entry.mode === 'stutter' ? 'Stuttering' : 'Phonological'}\n\n`;
    
    const feedback = entry.feedback;
    if (feedback) {
      if (feedback.content_summary) {
        text += `Topic: ${feedback.content_summary}\n\n`;
      }
      
      if (entry.mode === 'stutter') {
        if (feedback.overall_summary) {
          text += `Summary: ${feedback.overall_summary}\n\n`;
        }
        if (feedback.strengths && feedback.strengths.length > 0) {
          text += 'Strengths:\n';
          feedback.strengths.forEach(s => text += `  - ${s}\n`);
          text += '\n';
        }
        if (feedback.areas_for_improvement && feedback.areas_for_improvement.length > 0) {
          text += 'Areas for Improvement:\n';
          feedback.areas_for_improvement.forEach(a => text += `  - ${a}\n`);
          text += '\n';
        }
      } else {
        if (feedback.summary) {
          text += `Summary: ${feedback.summary}\n\n`;
        }
        if (feedback.scores) {
          text += `Scores:\n`;
          text += `  Pronunciation: ${feedback.scores.pronunciation || 'N/A'}%\n`;
          text += `  Intelligibility: ${feedback.scores.intelligibility || 'N/A'}%\n\n`;
        }
        if (feedback.differences && feedback.differences.length > 0) {
          text += 'Differences Found:\n';
          feedback.differences.forEach(d => {
            text += `  - ${d.type}: Expected "${d.reference}", heard "${d.observed}". ${d.note}\n`;
          });
          text += '\n';
        }
      }
      
      if (feedback.practice_tips && feedback.practice_tips.length > 0) {
        text += 'Practice Tips:\n';
        feedback.practice_tips.forEach(tip => text += `  - ${tip}\n`);
        text += '\n';
      }
    }
    
    if (entry.metadata.intake_text) {
      text += `Transcript: ${entry.metadata.intake_text}\n\n`;
    }
    
    text += '\n';
  });
  
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `speech-therapy-report-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportFeedbackHistoryPDF() {
  // Simple PDF generation using window.print() or a library
  // For now, we'll create a printable version
  const dateRange = document.getElementById('reportDateRange')?.value || 'all';
  const modeFilter = document.getElementById('reportModeFilter')?.value || 'all';
  const filteredHistory = getFilteredFeedbackHistory(dateRange, modeFilter);
  const summary = generateReportSummary(filteredHistory);
  const progress = window.progressSystem ? window.progressSystem.getProgress() : null;
  
  // Create a printable window
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Speech Therapy Progress Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        .summary { margin: 20px 0; }
        .entry { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .date { font-weight: bold; color: #666; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <h1>Speech Therapy Progress Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <div class="summary">
        <h2>Summary</h2>
        <p>Total Sessions: ${summary.totalSessions}</p>
        <p>Stuttering Sessions: ${summary.stutterSessions}</p>
        <p>Phonological Sessions: ${summary.phonologicalSessions}</p>
      </div>
      <h2>Feedback History</h2>
      ${filteredHistory.map((entry, index) => `
        <div class="entry">
          <div class="date">Session ${index + 1} - ${entry.date} ${entry.time}</div>
          <p><strong>Mode:</strong> ${entry.mode === 'stutter' ? 'Stuttering' : 'Phonological'}</p>
          ${entry.feedback ? `
            ${entry.feedback.content_summary ? `<p><strong>Topic:</strong> ${entry.feedback.content_summary}</p>` : ''}
            ${entry.feedback.overall_summary || entry.feedback.summary ? `<p>${entry.feedback.overall_summary || entry.feedback.summary}</p>` : ''}
          ` : ''}
        </div>
      `).join('')}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initFeedbackHistory();
  
  // Verify Progress Report section exists
  const reportSection = document.querySelector('.progress-report-section');
  if (!reportSection) {
    console.warn('Progress Report section not found in DOM');
  } else {
    console.log('Progress Report section found and initialized');
  }
  
  updateProgressReport();
  
  // Filter event listeners
  const dateRangeSelect = document.getElementById('reportDateRange');
  const modeFilterSelect = document.getElementById('reportModeFilter');
  
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', updateProgressReport);
  }
  if (modeFilterSelect) {
    modeFilterSelect.addEventListener('change', updateProgressReport);
  }
  
  // Export button listeners
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportTextBtn = document.getElementById('exportTextBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', exportFeedbackHistoryJSON);
  }
  if (exportTextBtn) {
    exportTextBtn.addEventListener('click', exportFeedbackHistoryText);
  }
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportFeedbackHistoryPDF);
  }
});

// Export functions for use in client.js
window.feedbackHistory = {
  saveFeedbackToHistory,
  getFeedbackHistory,
  updateProgressReport
};

