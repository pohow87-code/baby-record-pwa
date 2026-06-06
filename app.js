const STORAGE_KEY = "baby-log-records-v2";
const LEGACY_STORAGE_KEYS = ["baby-log-records-v1"];
const SETTINGS_KEY = "baby-log-settings-v1";
const ACTIVE_SLEEP_KEY = "baby-log-active-sleep-v2";
const ACTIVE_BREASTFEED_KEY = "baby-log-active-breastfeed-v1";
const HISTORY_FILTER_KEY = "baby-log-history-filter-v1";
const ACTIVE_TAB_KEY = "baby-log-active-tab-v1";
const SELECTED_STATS_DATE_KEY = "baby-log-selected-stats-date-v1";
const STATS_FILTER_KEY = "baby-log-stats-filter-v1";
const HISTORY_RENDER_LIMIT = 100;
const CAPACITOR_BACKUP_DIR = "backups";
const LONG_PRESS_MS = 550;

const FEED_AMOUNTS = [60, 80, 100, 120, 140, 160, 180];
const PUMP_AMOUNTS = [30, 60, 90, 120, 150, 180];
const DIAPER_STATUSES = ["소변", "대변", "소변+대변", "교체만"];

const defaultSettings = {
  feedAmount: 120,
  pumpAmount: 90,
  diaperStatus: "소변",
  weightValue: "",
};

const state = {
  records: loadRecords(),
  settings: loadSettings(),
  activeSleep: loadActiveSleep(),
  activeBreastfeed: loadActiveBreastfeed(),
  selectedTab: loadActiveTab(),
  selectedRange: "day",
  selectedStatsDate: loadSelectedStatsDate(),
  selectedStatFilters: loadStatFilters(),
  selectedHistoryFilter: loadHistoryFilter(),
  dialogRecordId: null,
  dialogMode: "edit",
  dialogDraftType: null,
};

const elements = {
  liveNow: document.querySelector('[data-role="live-now"]'),
  feedSummary: document.querySelector('[data-role="feed-summary"]'),
  breastfeedTitle: document.querySelector('[data-role="breastfeed-title"]'),
  breastfeedSummary: document.querySelector('[data-role="breastfeed-summary"]'),
  breastfeedTimer: document.querySelector('[data-role="breastfeed-timer"]'),
  diaperSummary: document.querySelector('[data-role="diaper-summary"]'),
  sleepTitle: document.querySelector('[data-role="sleep-title"]'),
  sleepSummary: document.querySelector('[data-role="sleep-summary"]'),
  sleepTimer: document.querySelector('[data-role="sleep-timer"]'),
  weightSummary: document.querySelector('[data-role="weight-summary"]'),
  pumpSummary: document.querySelector('[data-role="pump-summary"]'),
  feedSelection: document.querySelector('[data-role="feed-selection"]'),
  diaperSelection: document.querySelector('[data-role="diaper-selection"]'),
  weightSelection: document.querySelector('[data-role="weight-selection"]'),
  pumpSelection: document.querySelector('[data-role="pump-selection"]'),
  feedOptions: document.querySelector('[data-role="feed-options"]'),
  pumpOptions: document.querySelector('[data-role="pump-options"]'),
  diaperOptions: document.querySelector('[data-role="diaper-options"]'),
  feedInput: document.querySelector('[data-input="feed-amount"]'),
  pumpInput: document.querySelector('[data-input="pump-amount"]'),
  weightInput: document.querySelector('[data-input="weight-value"]'),
  memoInput: document.querySelector('[data-input="memo"]'),
  statsDateLabel: document.querySelector('[data-role="stats-date-label"]'),
  summaryCards: document.querySelector('[data-role="summary-cards"]'),
  statsFilters: document.querySelector('[data-role="stats-filters"]'),
  statsCharts: document.querySelector('[data-role="stats-charts"]'),
  calendarMonthLabel: document.querySelector('[data-role="calendar-month-label"]'),
  statsCalendarGrid: document.querySelector('[data-role="stats-calendar-grid"]'),
  recordCount: document.querySelector('[data-role="record-count"]'),
  historyList: document.querySelector('[data-role="history-list"]'),
  toast: document.querySelector('[data-role="toast"]'),
  importFile: document.querySelector('[data-role="import-file"]'),
  recordDialog: document.querySelector('[data-role="record-dialog"]'),
  dialogTitle: document.querySelector('[data-role="dialog-title"]'),
  dialogFields: document.querySelector('[data-role="dialog-fields"]'),
  dialogDeleteButton: document.querySelector('[data-action="delete-record"]'),
  dialogSaveButton: document.querySelector('[data-action="save-record"]'),
  tabButtons: Array.from(document.querySelectorAll("[data-tab]")),
  tabScreens: Array.from(document.querySelectorAll("[data-tab-screen]")),
  rangeTabs: Array.from(document.querySelectorAll("[data-range]")),
  historyFilterTabs: Array.from(document.querySelectorAll("[data-history-filter]")),
};

init();

function init() {
  hydrateInputs();
  renderDefaultOptions();
  bindEvents();
  startClock();
  updateActiveTab();
  updateRangeTabs();
  updateHistoryFilterTabs();
  render();
}

function bindEvents() {
  document.addEventListener("click", handleDocumentClick);
  bindLongPressActions();

  elements.feedInput.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    if (value > 0) {
      state.settings.feedAmount = value;
      saveSettings();
      renderDefaultOptions();
      renderQuickSummaries();
    }
  });

  elements.weightInput.addEventListener("input", (event) => {
    state.settings.weightValue = sanitizeWeightInput(event.target.value);
    saveSettings();
    renderQuickSummaries();
  });

  elements.pumpInput.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    if (value > 0) {
      state.settings.pumpAmount = value;
      saveSettings();
      renderDefaultOptions();
      renderQuickSummaries();
    }
  });

  elements.importFile.addEventListener("change", handleImportFile);
  elements.recordDialog.addEventListener("close", resetDialogState);
  elements.dialogFields.addEventListener("input", updateDialogDerivedFields);
  elements.dialogFields.addEventListener("change", updateDialogDerivedFields);

  elements.rangeTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRange = button.dataset.range;
      updateRangeTabs();
      renderStats();
    });
  });

}

let suppressedAction = null;

function bindLongPressActions() {
  bindLongPressAction("breastfeed", {
    shouldStart: () => Boolean(state.activeBreastfeed) && !state.activeBreastfeed.isPaused,
    onLongPress: pauseBreastfeed,
  });

  ["feed", "diaper", "weight", "pump"].forEach((action) => {
    bindLongPressAction(action, {
      shouldStart: () => true,
      onLongPress: () => openCreateRecordDialog(action),
    });
  });
}

function bindLongPressAction(action, { shouldStart, onLongPress }) {
  const button = document.querySelector(`[data-action="${action}"]`);
  if (!button) {
    return;
  }

  let timer = null;
  let pressed = false;

  const clearPress = () => {
    pressed = false;
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  button.addEventListener("pointerdown", () => {
    if (!shouldStart()) {
      return;
    }
    pressed = true;
    timer = window.setTimeout(() => {
      if (!pressed) {
        return;
      }
      suppressedAction = action;
      onLongPress();
    }, LONG_PRESS_MS);
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
    button.addEventListener(eventName, clearPress);
  });
}

function handleDocumentClick(event) {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    state.selectedTab = tabButton.dataset.tab;
    saveActiveTab();
    updateActiveTab();
    return;
  }

  const historyItem = event.target.closest("[data-record-id]");
  if (historyItem) {
    openRecordDialog(historyItem.dataset.recordId);
    return;
  }

  const historyFilterButton = event.target.closest("[data-history-filter]");
  if (historyFilterButton) {
    state.selectedHistoryFilter = historyFilterButton.dataset.historyFilter;
    saveHistoryFilter();
    updateHistoryFilterTabs();
    renderHistoryList();
    return;
  }

  const statsFilterButton = event.target.closest("[data-stats-filter]");
  if (statsFilterButton) {
    toggleStatFilter(statsFilterButton.dataset.statsFilter);
    return;
  }

  const calendarDateButton = event.target.closest("[data-calendar-date]");
  if (calendarDateButton) {
    const selectedDate = calendarDateButton.dataset.calendarDate;
    if (selectedDate) {
      state.selectedStatsDate = selectedDate;
      saveSelectedStatsDate();
      renderStats();
    }
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const { action } = actionButton.dataset;
    if (suppressedAction === action) {
      suppressedAction = null;
      return;
    }
    const actionMap = {
      feed: logFeed,
      breastfeed: toggleBreastfeed,
      diaper: logDiaper,
      sleep: toggleSleep,
      weight: logWeight,
      pump: logPump,
      memo: logMemo,
      "calendar-prev": () => shiftCalendarMonth(-1),
      "calendar-next": () => shiftCalendarMonth(1),
      "calendar-today": selectTodayForStats,
      "clear-all": clearAllRecords,
      "export-records": exportRecords,
      "import-records": triggerImport,
      "save-record": saveEditedRecord,
      "delete-record": deleteDialogRecord,
    };
    actionMap[action]?.();
    return;
  }

  const optionButton = event.target.closest("[data-setting]");
  if (optionButton) {
    updateSetting(optionButton.dataset.setting, optionButton.dataset.value);
  }
}

function hydrateInputs() {
  elements.feedInput.value = "";
  elements.pumpInput.value = "";
  elements.weightInput.value = state.settings.weightValue;
}

function renderDefaultOptions() {
  renderChipList({
    container: elements.feedOptions,
    items: FEED_AMOUNTS.map(String),
    selectedValue: String(state.settings.feedAmount),
    setting: "feedAmount",
    formatLabel: (value) => `${value} ml`,
  });

  renderChipList({
    container: elements.pumpOptions,
    items: PUMP_AMOUNTS.map(String),
    selectedValue: String(state.settings.pumpAmount),
    setting: "pumpAmount",
    formatLabel: (value) => `${value} ml`,
  });

  renderChipList({
    container: elements.diaperOptions,
    items: DIAPER_STATUSES,
    selectedValue: state.settings.diaperStatus,
    setting: "diaperStatus",
  });

  elements.feedSelection.textContent = `${state.settings.feedAmount} ml`;
  elements.pumpSelection.textContent = `${state.settings.pumpAmount} ml`;
  elements.diaperSelection.textContent = state.settings.diaperStatus;
  elements.weightSelection.textContent = state.settings.weightValue
    ? `${formatWeightValue(state.settings.weightValue)} kg`
    : "입력 대기";
}

function renderChipList({ container, items, selectedValue, setting, formatLabel = (value) => value }) {
  container.innerHTML = items
    .map((item) => {
      const activeClass = item === selectedValue ? " active" : "";
      return `
        <button
          class="chip${activeClass}"
          type="button"
          data-setting="${setting}"
          data-value="${item}"
        >
          ${formatLabel(item)}
        </button>
      `;
    })
    .join("");
}

function updateSetting(setting, value) {
  if (setting === "feedAmount") {
    state.settings.feedAmount = Number(value);
    elements.feedInput.value = "";
  }

  if (setting === "pumpAmount") {
    state.settings.pumpAmount = Number(value);
    elements.pumpInput.value = "";
  }

  if (setting === "diaperStatus") {
    state.settings.diaperStatus = value;
  }

  saveSettings();
  renderDefaultOptions();
  renderQuickSummaries();
}

function render() {
  state.records.sort((a, b) => b.timestamp - a.timestamp);
  renderQuickSummaries();
  renderStats();
  renderHistoryList();
}

function renderQuickSummaries() {
  elements.feedSummary.textContent = `${state.settings.feedAmount}ml 빠른 기록 · 길게 눌러 입력`;
  elements.pumpSummary.textContent = `${state.settings.pumpAmount}ml 빠른 기록 · 길게 눌러 입력`;
  elements.diaperSummary.textContent = `${state.settings.diaperStatus} 빠른 기록 · 길게 눌러 입력`;
  elements.weightSummary.textContent = state.settings.weightValue
    ? `${formatWeightValue(state.settings.weightValue)}kg 빠른 기록 · 길게 눌러 입력`
    : "길게 눌러 몸무게 입력";

  if (state.activeBreastfeed) {
    const elapsedMs = Math.max(1000, getBreastfeedElapsedMs());
    const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const card = document.querySelector('[data-action="breastfeed"]');
    card.classList.add("active-session");
    card.classList.toggle("paused-session", state.activeBreastfeed.isPaused);
    elements.breastfeedTitle.textContent = state.activeBreastfeed.isPaused ? "모유수유 재개" : "모유수유 종료";
    elements.breastfeedSummary.textContent = state.activeBreastfeed.isPaused
      ? `${formatTime(state.activeBreastfeed.start)} 시작 · 일시정지 중`
      : `${formatTime(state.activeBreastfeed.start)} 시작 · ${formatSleep(elapsedMinutes)} 기록 중`;
    elements.breastfeedTimer.textContent = formatElapsedHms(elapsedMs);
  } else {
    const card = document.querySelector('[data-action="breastfeed"]');
    card.classList.remove("active-session");
    card.classList.remove("paused-session");
    elements.breastfeedTitle.textContent = "모유수유 시작";
    elements.breastfeedSummary.textContent = "탭 시작 · 길게 눌러 일시정지";
    elements.breastfeedTimer.textContent = "";
  }

  if (state.activeSleep) {
    const elapsedMs = Math.max(1000, Date.now() - state.activeSleep.start);
    const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const card = document.querySelector('[data-action="sleep"]');
    card.classList.add("sleeping");
    elements.sleepTitle.textContent = "수면 종료";
    elements.sleepSummary.textContent = `${formatTime(state.activeSleep.start)} 시작 · ${formatSleep(elapsedMinutes)} 진행 중`;
    elements.sleepTimer.textContent = formatElapsedHms(elapsedMs);
  } else {
    const card = document.querySelector('[data-action="sleep"]');
    card.classList.remove("sleeping");
    elements.sleepTitle.textContent = "수면 시작";
    elements.sleepSummary.textContent = "탭 한 번으로 수면 시작";
    elements.sleepTimer.textContent = "";
  }
}

function logFeed() {
  addRecord({
    type: "feed",
    timestamp: Date.now(),
    amount: Number(state.settings.feedAmount),
  });
  showToast(`분유 ${state.settings.feedAmount}ml 기록 완료`);
}

function toggleBreastfeed() {
  if (!state.activeBreastfeed) {
    state.activeBreastfeed = createActiveBreastfeedSession(Date.now());
    saveActiveBreastfeed();
    renderQuickSummaries();
    showToast("모유수유 시작 기록 완료");
    return;
  }

  if (state.activeBreastfeed.isPaused) {
    resumeBreastfeed();
    return;
  }

  const end = Date.now();
  const start = state.activeBreastfeed.start;
  const durationMinutes = Math.max(1, Math.round(getBreastfeedElapsedMs(end) / 60000));
  state.activeBreastfeed = null;
  saveActiveBreastfeed();

  addRecord({
    type: "breastfeed",
    timestamp: end,
    start,
    end,
    durationMinutes,
  });
  showToast("모유수유 종료 기록 완료");
}

function pauseBreastfeed() {
  if (!state.activeBreastfeed || state.activeBreastfeed.isPaused) {
    return;
  }

  state.activeBreastfeed = {
    ...state.activeBreastfeed,
    isPaused: true,
    pausedAt: Date.now(),
  };
  saveActiveBreastfeed();
  renderQuickSummaries();
  showToast("모유수유 일시정지");
}

function resumeBreastfeed() {
  if (!state.activeBreastfeed?.isPaused) {
    return;
  }

  const now = Date.now();
  const pausedDurationMs = state.activeBreastfeed.pausedDurationMs + Math.max(0, now - state.activeBreastfeed.pausedAt);
  state.activeBreastfeed = {
    ...state.activeBreastfeed,
    isPaused: false,
    pausedAt: null,
    pausedDurationMs,
  };
  saveActiveBreastfeed();
  renderQuickSummaries();
  showToast("모유수유 재개");
}

function logDiaper() {
  addRecord({
    type: "diaper",
    timestamp: Date.now(),
    status: state.settings.diaperStatus,
  });
  showToast(`기저귀 ${state.settings.diaperStatus} 기록 완료`);
}

function toggleSleep() {
  if (!state.activeSleep) {
    state.activeSleep = { start: Date.now() };
    saveActiveSleep();
    renderQuickSummaries();
    showToast("수면 시작 기록 완료");
    return;
  }

  const end = Date.now();
  const start = state.activeSleep.start;
  state.activeSleep = null;
  saveActiveSleep();

  addRecord({
    type: "sleep",
    timestamp: end,
    start,
    end,
    durationMinutes: Math.max(1, Math.round((end - start) / 60000)),
  });
  showToast("수면 종료 기록 완료");
}

function logWeight() {
  const weightValue = Number(state.settings.weightValue);
  if (!weightValue) {
    showToast("몸무게를 먼저 입력해주세요");
    elements.weightInput.focus();
    return;
  }

  addRecord({
    type: "weight",
    timestamp: Date.now(),
    weight: truncateWeightValue(weightValue),
  });
  showToast(`몸무게 ${formatWeightValue(weightValue)}kg 기록 완료`);
}

function logPump() {
  addRecord({
    type: "pump",
    timestamp: Date.now(),
    amount: Number(state.settings.pumpAmount),
  });
  showToast(`유축 ${state.settings.pumpAmount}ml 기록 완료`);
}

function logMemo() {
  const text = elements.memoInput.value.trim();
  if (!text) {
    showToast("메모 내용을 먼저 입력해주세요");
    return;
  }

  addRecord({
    type: "memo",
    timestamp: Date.now(),
    text,
  });
  elements.memoInput.value = "";
  showToast("메모 저장 완료");
}

function clearAllRecords() {
  const confirmed = window.confirm("모든 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.");
  if (!confirmed) {
    return;
  }

  state.records = [];
  state.activeSleep = null;
  state.activeBreastfeed = null;
  saveRecords();
  saveActiveSleep();
  saveActiveBreastfeed();
  render();
  showToast("모든 기록을 삭제했습니다");
}

function addRecord(record) {
  state.records.unshift({
    id: createId(),
    ...record,
  });
  syncRecentSettings(record);
  saveRecords();
  render();
}

function updateRecord(recordId, nextRecord) {
  const index = state.records.findIndex((record) => record.id === recordId);
  if (index === -1) {
    return;
  }

  state.records[index] = {
    ...state.records[index],
    ...nextRecord,
  };
  syncRecentSettings(state.records[index]);
  saveRecords();
  render();
}

function deleteRecord(recordId) {
  state.records = state.records.filter((record) => record.id !== recordId);
  saveRecords();
  render();
}

function renderStats() {
  const selectedDate = parseDateKey(state.selectedStatsDate);
  const rangeWindow = getStatsRangeWindow(state.selectedRange, selectedDate);
  const rangeRecords = getRecordsInWindow(rangeWindow.start, rangeWindow.end);
  const statItems = getStatItems();
  const activeItems = statItems.filter((item) => state.selectedStatFilters.includes(item.key));
  const bucketSeries = buildStatsSeries(rangeRecords, rangeWindow.buckets);
  const groupedCharts = buildStatChartGroups(activeItems, bucketSeries);

  elements.statsDateLabel.textContent = rangeWindow.label;
  renderStatFilters(statItems);
  renderSummaryCards(activeItems, rangeRecords);
  renderStatsCharts(groupedCharts, rangeWindow);
  renderStatsCalendar(selectedDate);
}

function renderStatFilters(statItems) {
  elements.statsFilters.innerHTML = statItems
    .map((item) => {
      const activeClass = state.selectedStatFilters.includes(item.key) ? " active" : "";
      return `
        <button class="chip stats-filter-chip${activeClass}" type="button" data-stats-filter="${item.key}">
          ${item.label}
        </button>
      `;
    })
    .join("");
}

function renderSummaryCards(activeItems, records) {
  if (!activeItems.length) {
    elements.summaryCards.innerHTML = `<div class="empty-state">표시할 통계 항목을 선택해주세요.</div>`;
    return;
  }

  elements.summaryCards.innerHTML = activeItems
    .map((item) => {
      const summary = item.summarize(records);
      return `
        <article class="summary-card">
          <div class="label">${item.label}</div>
          <div class="value">${summary.value}</div>
          <div class="summary-card__meta">${summary.meta}</div>
        </article>
      `;
    })
    .join("");
}

function renderStatsCharts(groupedCharts, rangeWindow) {
  if (!groupedCharts.length) {
    elements.statsCharts.innerHTML = `<div class="empty-state">선택한 항목에 맞는 그래프가 없습니다.</div>`;
    return;
  }

  elements.statsCharts.innerHTML = groupedCharts
    .map(
      (group) => `
        <article class="chart-panel component component--stats-chart">
          <div class="chart-head">
            <h3>${group.title}</h3>
            <p>${rangeWindow.chartLabel}</p>
          </div>
          <div class="chart-legend">
            ${group.metrics
              .map(
                (metric) => `
                  <span class="legend-item">
                    <span class="legend-line${metric.dashed ? " legend-line--dashed" : ""}" style="color:${metric.color}"></span>
                    ${metric.label}
                  </span>
                `
              )
              .join("")}
          </div>
          <canvas data-stats-group="${group.key}" width="320" height="220"></canvas>
        </article>
      `
    )
    .join("");

  groupedCharts.forEach((group) => {
    const canvas = elements.statsCharts.querySelector(`[data-stats-group="${group.key}"]`);
    if (canvas) {
      drawStatsChart(canvas, group.metrics, group.buckets);
    }
  });
}

function renderStatsCalendar(selectedDate) {
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const calendarStart = getStartOfWeek(monthStart, true);
  const calendarDays = [];
  const recordDays = new Set(state.records.map((record) => formatDateKey(new Date(record.timestamp))));

  elements.calendarMonthLabel.textContent = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월`;

  for (let index = 0; index < 42; index += 1) {
    const currentDate = addLocalDays(calendarStart, index);
    const dateKey = formatDateKey(currentDate);
    const inMonth = currentDate.getMonth() === selectedDate.getMonth();
    const isSelected = dateKey === state.selectedStatsDate;
    const isToday = dateKey === formatDateKey(new Date());
    const hasRecords = recordDays.has(dateKey);
    calendarDays.push(`
      <button
        class="calendar-day${inMonth ? "" : " is-outside"}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}"
        type="button"
        data-calendar-date="${dateKey}"
      >
        <span class="calendar-day__number">${currentDate.getDate()}</span>
        <span class="calendar-day__dot${hasRecords ? " has-records" : ""}"></span>
      </button>
    `);
  }

  elements.statsCalendarGrid.innerHTML = calendarDays.join("");
}

function getStatItems() {
  return [
    {
      key: "feedVolume",
      label: "분유량",
      group: "volume",
      unit: "ml",
      color: "#f29157",
      summarize: (records) => {
        const total = records.filter((item) => item.type === "feed").reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const count = records.filter((item) => item.type === "feed").length;
        return { value: `${total} ml`, meta: `${count}회` };
      },
    },
    {
      key: "breastfeedMinutes",
      label: "모유수유 시간",
      group: "time",
      unit: "시간",
      color: "#ef7fa5",
      summarize: (records) => {
        const minutes = records.filter((item) => item.type === "breastfeed").reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
        const count = records.filter((item) => item.type === "breastfeed").length;
        return { value: `${roundOne(minutes / 60).toFixed(1)} 시간`, meta: `${count}회` };
      },
    },
    {
      key: "pumpVolume",
      label: "유축량",
      group: "volume",
      unit: "ml",
      color: "#9d83ff",
      summarize: (records) => {
        const total = records.filter((item) => item.type === "pump").reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const count = records.filter((item) => item.type === "pump").length;
        return { value: `${total} ml`, meta: `${count}회` };
      },
    },
    {
      key: "diaperCount",
      label: "기저귀 횟수",
      group: "count",
      unit: "회",
      color: "#d4a72c",
      summarize: (records) => {
        const count = records.filter((item) => item.type === "diaper").length;
        return { value: `${count}회`, meta: "기록 수" };
      },
    },
    {
      key: "sleepMinutes",
      label: "수면 시간",
      group: "time",
      unit: "시간",
      color: "#7fa6ff",
      summarize: (records) => {
        const minutes = records.filter((item) => item.type === "sleep").reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
        const count = records.filter((item) => item.type === "sleep").length;
        return { value: `${roundOne(minutes / 60).toFixed(1)} 시간`, meta: `${count}회` };
      },
    },
    {
      key: "weightValue",
      label: "몸무게",
      group: "weight",
      unit: "kg",
      color: "#64b88f",
      dashed: true,
      summarize: (records) => {
        const weightRecords = records.filter((item) => item.type === "weight").sort((a, b) => b.timestamp - a.timestamp);
        const latestWeight = weightRecords[0]?.weight;
        return {
          value: typeof latestWeight === "number" ? `${formatWeightValue(latestWeight)} kg` : "-",
          meta: weightRecords.length ? `${weightRecords.length}개 기록` : "기록 없음",
        };
      },
    },
  ];
}

function buildStatsSeries(records, buckets) {
  return buckets.map((bucket) => {
    const bucketRecords = records.filter((item) => item.timestamp >= bucket.start && item.timestamp < bucket.end);
    const latestWeight = [...bucketRecords].filter((item) => item.type === "weight").sort((a, b) => b.timestamp - a.timestamp)[0]?.weight ?? null;
    return {
      label: bucket.label,
      feedVolume: bucketRecords.filter((item) => item.type === "feed").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      breastfeedMinutes: bucketRecords.filter((item) => item.type === "breastfeed").reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0),
      pumpVolume: bucketRecords.filter((item) => item.type === "pump").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      diaperCount: bucketRecords.filter((item) => item.type === "diaper").length,
      sleepMinutes: bucketRecords.filter((item) => item.type === "sleep").reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0),
      weightValue: latestWeight,
    };
  });
}

function buildStatChartGroups(activeItems, buckets) {
  const groupLabels = {
    volume: "양 그래프",
    time: "시간 그래프",
    count: "횟수 그래프",
    weight: "몸무게 그래프",
  };

  return ["volume", "time", "count", "weight"]
    .map((groupKey) => {
      const metrics = activeItems
        .filter((item) => item.group === groupKey)
        .map((item) => ({
          key: item.key,
          label: item.label,
          color: item.color,
          dashed: Boolean(item.dashed),
          values: buckets.map((bucket) => ({
            label: bucket.label,
            value: normalizeMetricValue(item.key, bucket[item.key]),
          })),
        }));

      if (!metrics.length) {
        return null;
      }

      return {
        key: groupKey,
        title: groupLabels[groupKey],
        metrics,
        buckets: buckets.map((bucket) => ({ label: bucket.label })),
      };
    })
    .filter(Boolean);
}

function drawStatsChart(canvas, metrics, buckets) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 22, right: 18, bottom: 42, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const pointCount = Math.max(1, buckets.length);
  const stepX = pointCount > 1 ? chartWidth / (pointCount - 1) : 0;
  const rawValues = metrics.flatMap((metric) => metric.values.map((item) => item.value)).filter((value) => value !== null);
  const maxValue = rawValues.length ? Math.max(...rawValues, 1) : 1;
  const minValue = metrics.every((metric) => metric.key === "weightValue") && rawValues.length ? Math.min(...rawValues) - 0.2 : 0;

  drawChartGrid(ctx, width, height, padding);

  metrics.forEach((metric) => {
    const points = metric.values
      .map((item, index) => {
        if (item.value === null) {
          return null;
        }
        return {
          x: padding.left + stepX * index,
          y: mapValue(item.value, minValue, maxValue, height - padding.bottom, padding.top),
        };
      })
      .filter(Boolean);
    drawMetricLine(ctx, points, metric.color, metric.dashed);
  });

  ctx.fillStyle = "rgba(125, 104, 88, 0.9)";
  ctx.font = "12px Segoe UI";
  buckets.forEach((bucket, index) => {
    const x = padding.left + stepX * index;
    ctx.textAlign = "center";
    ctx.fillText(bucket.label, x, height - 14);
  });
}

function drawChartGrid(ctx, width, height, padding) {
  ctx.strokeStyle = "rgba(125, 104, 88, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
}

function drawMetricLine(ctx, points, color, dashed) {
  if (!points.length) {
    return;
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash(dashed ? [8, 6] : []);
  ctx.stroke();
  ctx.setLineDash([]);

  points.forEach((point) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderHistoryList() {
  const visibleRecords = getHistoryRecords().slice(0, HISTORY_RENDER_LIMIT);
  const filterLabelMap = {
    all: "전체",
    feed: "분유",
    breastfeed: "모유수유",
    diaper: "기저귀",
    pump: "유축",
    sleep: "수면",
    weight: "몸무게",
    memo: "메모",
  };
  elements.recordCount.textContent = `${filterLabelMap[state.selectedHistoryFilter]} ${visibleRecords.length}개`;

  if (!visibleRecords.length) {
    elements.historyList.innerHTML = `<div class="empty-state">${filterLabelMap[state.selectedHistoryFilter]} 기록이 없습니다.</div>`;
    return;
  }

  elements.historyList.innerHTML = visibleRecords
    .map((record) => {
      const detail = getRecordDetail(record);
      return `
        <article class="history-item" data-record-id="${record.id}">
          <div class="icon" style="background:${detail.color}">${detail.icon}</div>
          <div class="meta">
            <strong>${detail.title}</strong>
            <span>${detail.description}</span>
          </div>
          <time>${formatDateTime(record.timestamp)}</time>
        </article>
      `;
    })
    .join("");
}

function getHistoryRecords() {
  if (state.selectedHistoryFilter === "all") {
    return state.records;
  }

  return state.records.filter((record) => record.type === state.selectedHistoryFilter);
}

function getRecordDetail(record) {
  const detailByType = {
    feed: {
      icon: "🍼",
      color: "#ffe3cf",
      title: "분유",
      description: `${record.amount}ml`,
    },
    breastfeed: {
      icon: "🤱",
      color: "#ffe0ea",
      title: "모유수유",
      description: `${formatSleep(getRecordDurationMinutes(record))} · ${formatTime(record.start)} - ${formatTime(record.end)}`,
    },
    diaper: {
      icon: "🧷",
      color: "#fff1c0",
      title: "기저귀",
      description: record.status,
    },
    sleep: {
      icon: "😴",
      color: "#dfe8ff",
      title: "수면",
      description: `${formatTime(record.start)} - ${formatTime(record.end)} · ${formatSleep(getRecordDurationMinutes(record))}`,
    },
    weight: {
      icon: "⚖️",
      color: "#dcf2e5",
      title: "몸무게",
      description: typeof record.weight === "number" ? `${formatWeightValue(record.weight)}kg` : "-",
    },
    pump: {
      icon: "🧴",
      color: "#efe5ff",
      title: "유축",
      description: `${record.amount}ml`,
    },
    memo: {
      icon: "📝",
      color: "#f7e4ff",
      title: "메모",
      description: record.text,
    },
  };

  return detailByType[record.type];
}

function openRecordDialog(recordId) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }

  state.dialogMode = "edit";
  state.dialogRecordId = recordId;
  state.dialogDraftType = record.type;
  elements.dialogTitle.textContent = `${getRecordDetail(record).title} 수정`;
  elements.dialogFields.innerHTML = buildDialogFields(record);
  elements.dialogDeleteButton.hidden = false;
  elements.dialogSaveButton.textContent = "수정 저장";
  updateDialogDerivedFields();
  elements.recordDialog.showModal();
}

function openCreateRecordDialog(type) {
  const draft = createDraftRecord(type);
  state.dialogMode = "create";
  state.dialogDraftType = type;
  state.dialogRecordId = null;
  elements.dialogTitle.textContent = `${getTypeLabel(type)} 기록`;
  elements.dialogFields.innerHTML = buildDialogFields(draft);
  elements.dialogDeleteButton.hidden = true;
  elements.dialogSaveButton.textContent = "기록 저장";
  updateDialogDerivedFields();
  elements.recordDialog.showModal();
}

function buildDialogFields(record) {
  const timestampField = `
    <label class="input-row">
      <span>시간</span>
      <input type="datetime-local" data-dialog-field="timestamp" value="${toDatetimeLocal(record.timestamp)}" />
    </label>
  `;

  if (record.type === "feed") {
    return `${timestampField}
      <label class="input-row">
        <span>분유량 (ml)</span>
        <input type="number" min="0" step="10" data-dialog-field="amount" value="${record.amount ?? ""}" />
      </label>`;
  }

  if (record.type === "breastfeed") {
    const durationRecord = {
      start: record.start,
      end: record.end,
      durationMinutes: record.durationMinutes,
    };
    return `
      <label class="input-row">
        <span>시작</span>
        <input type="datetime-local" data-dialog-field="start" value="${toDatetimeLocal(record.start)}" />
      </label>
      <label class="input-row">
        <span>종료</span>
        <input type="datetime-local" data-dialog-field="end" value="${toDatetimeLocal(record.end)}" />
      </label>
      <div class="input-row input-row--readonly">
        <span>수유 시간</span>
        <div class="readonly-value" data-role="dialog-breastfeed-duration">${formatSleep(getRecordDurationMinutes(durationRecord))}</div>
      </div>`;
  }

  if (record.type === "diaper") {
    return `${timestampField}
      <label class="input-row">
        <span>상태</span>
        <select class="select-field" data-dialog-field="status">
          ${DIAPER_STATUSES.map((status) => `<option value="${status}"${record.status === status ? " selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>`;
  }

  if (record.type === "sleep") {
    return `
      <label class="input-row">
        <span>시작</span>
        <input type="datetime-local" data-dialog-field="start" value="${toDatetimeLocal(record.start)}" />
      </label>
      <label class="input-row">
        <span>종료</span>
        <input type="datetime-local" data-dialog-field="end" value="${toDatetimeLocal(record.end)}" />
      </label>`;
  }

  if (record.type === "weight") {
    return `${timestampField}
      <label class="input-row">
        <span>몸무게 (kg)</span>
        <input type="number" min="0" step="0.001" data-dialog-field="weight" value="${record.weight ?? ""}" />
      </label>`;
  }

  if (record.type === "pump") {
    return `${timestampField}
      <label class="input-row">
        <span>유축량 (ml)</span>
        <input type="number" min="0" step="10" data-dialog-field="amount" value="${record.amount ?? ""}" />
      </label>`;
  }

  return `${timestampField}
    <label class="input-row">
      <span>메모</span>
      <textarea rows="4" data-dialog-field="text">${record.text ?? ""}</textarea>
    </label>`;
}

function saveEditedRecord() {
  if (state.dialogMode === "create") {
    saveCreatedRecord();
    return;
  }

  const record = state.records.find((item) => item.id === state.dialogRecordId);
  if (!record) {
    return;
  }

  if (record.type === "feed") {
    const amount = Number(getDialogValue("amount"));
    if (!amount) {
      showToast("분유량을 입력해주세요");
      return;
    }
    updateRecord(record.id, {
      timestamp: fromDatetimeLocal(getDialogValue("timestamp")),
      amount,
    });
  } else if (record.type === "breastfeed") {
    const start = fromDatetimeLocal(getDialogValue("start"));
    const end = fromDatetimeLocal(getDialogValue("end"));
    const durationRecord = { start, end };
    updateRecord(record.id, {
      timestamp: end,
      start,
      end,
      durationMinutes: getRecordDurationMinutes(durationRecord),
    });
  } else if (record.type === "diaper") {
    updateRecord(record.id, {
      timestamp: fromDatetimeLocal(getDialogValue("timestamp")),
      status: getDialogValue("status"),
    });
  } else if (record.type === "sleep") {
    const start = fromDatetimeLocal(getDialogValue("start"));
    const end = fromDatetimeLocal(getDialogValue("end"));
    updateRecord(record.id, {
      timestamp: end,
      start,
      end,
      durationMinutes: Math.max(1, Math.round((end - start) / 60000)),
    });
  } else if (record.type === "weight") {
    const weight = truncateWeightValue(Number(getDialogValue("weight")));
    if (!weight) {
      showToast("몸무게를 입력해주세요");
      return;
    }
    updateRecord(record.id, {
      timestamp: fromDatetimeLocal(getDialogValue("timestamp")),
      weight,
    });
  } else if (record.type === "pump") {
    const amount = Number(getDialogValue("amount"));
    if (!amount) {
      showToast("유축량을 입력해주세요");
      return;
    }
    updateRecord(record.id, {
      timestamp: fromDatetimeLocal(getDialogValue("timestamp")),
      amount,
    });
  } else {
    const text = getDialogValue("text").trim();
    if (!text) {
      showToast("메모 내용을 입력해주세요");
      return;
    }
    updateRecord(record.id, {
      timestamp: fromDatetimeLocal(getDialogValue("timestamp")),
      text,
    });
  }

  closeRecordDialog();
  showToast("기록 수정 완료");
}

function saveCreatedRecord() {
  const type = state.dialogDraftType;
  if (!type) {
    return;
  }

  const timestamp = fromDatetimeLocal(getDialogValue("timestamp"));

  if (type === "feed") {
    const amount = Number(getDialogValue("amount"));
    if (!amount) {
      showToast("분유량을 입력해주세요");
      return;
    }
    addRecord({
      type,
      timestamp,
      amount,
    });
  } else if (type === "diaper") {
    addRecord({
      type,
      timestamp,
      status: getDialogValue("status"),
    });
  } else if (type === "weight") {
    const weight = truncateWeightValue(Number(getDialogValue("weight")));
    if (!weight) {
      showToast("몸무게를 입력해주세요");
      return;
    }
    addRecord({
      type,
      timestamp,
      weight,
    });
  } else if (type === "pump") {
    const amount = Number(getDialogValue("amount"));
    if (!amount) {
      showToast("유축량을 입력해주세요");
      return;
    }
    addRecord({
      type,
      timestamp,
      amount,
    });
  } else if (type === "memo") {
    const text = getDialogValue("text").trim();
    if (!text) {
      showToast("메모 내용을 입력해주세요");
      return;
    }
    addRecord({
      type,
      timestamp,
      text,
    });
  }

  closeRecordDialog();
  showToast("기록 저장 완료");
}

function deleteDialogRecord() {
  if (!state.dialogRecordId) {
    return;
  }
  const confirmed = window.confirm("이 기록을 삭제할까요?");
  if (!confirmed) {
    return;
  }
  deleteRecord(state.dialogRecordId);
  closeRecordDialog();
  showToast("기록 삭제 완료");
}

function closeRecordDialog() {
  state.dialogRecordId = null;
  elements.recordDialog.close();
}

function resetDialogState() {
  state.dialogRecordId = null;
  state.dialogMode = "edit";
  state.dialogDraftType = null;
  elements.dialogDeleteButton.hidden = false;
  elements.dialogSaveButton.textContent = "수정 저장";
}

function getDialogValue(field) {
  return elements.dialogFields.querySelector(`[data-dialog-field="${field}"]`)?.value ?? "";
}

function updateDialogDerivedFields() {
  const durationLabel = elements.dialogFields.querySelector('[data-role="dialog-breastfeed-duration"]');
  if (!durationLabel) {
    return;
  }

  const start = fromDatetimeLocal(getDialogValue("start"));
  const end = fromDatetimeLocal(getDialogValue("end"));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    durationLabel.textContent = "-";
    return;
  }

  durationLabel.textContent = formatSleep(
    getRecordDurationMinutes({
      start,
      end,
    })
  );
}

function startClock() {
  updateClock();
  window.setInterval(() => {
    updateClock();
    if (state.activeSleep || state.activeBreastfeed) {
      renderQuickSummaries();
    }
  }, 1000);
}

function updateActiveTab() {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.selectedTab);
  });

  elements.tabScreens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.tabScreen === state.selectedTab);
  });

  if (state.selectedTab === "stats") {
    window.requestAnimationFrame(() => {
      renderStats();
    });
  }
}

function updateClock() {
  elements.liveNow.textContent = formatDateTime(Date.now());
}

function updateRangeTabs() {
  elements.rangeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.range === state.selectedRange);
  });
}

function updateHistoryFilterTabs() {
  elements.historyFilterTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.historyFilter === state.selectedHistoryFilter);
  });
}

function getWindowedRecords(range) {
  const rangeWindow = getStatsRangeWindow(range, parseDateKey(state.selectedStatsDate));
  const start = rangeWindow.start;
  const end = rangeWindow.end;
  return state.records.filter((record) => record.timestamp >= start && record.timestamp < end);
}

function getStatsRangeWindow(range, selectedDate) {
  if (range === "day") {
    const startDate = startOfLocalDay(selectedDate);
    const start = startDate.getTime();
    return {
      start,
      end: addLocalDays(startDate, 1).getTime(),
      label: `${formatLongDate(startDate)} 하루 통계`,
      chartLabel: "3시간 단위 합계",
      buckets: Array.from({ length: 8 }, (_, index) => {
        const bucketStart = start + index * 3 * 60 * 60 * 1000;
        return {
          label: `${String(index * 3).padStart(2, "0")}시`,
          start: bucketStart,
          end: bucketStart + 3 * 60 * 60 * 1000,
        };
      }),
    };
  }

  if (range === "week") {
    const weekStart = getStartOfWeek(selectedDate, true);
    return {
      start: weekStart.getTime(),
      end: addLocalDays(weekStart, 7).getTime(),
      label: `${formatLongDate(weekStart)} - ${formatLongDate(addLocalDays(weekStart, 6))}`,
      chartLabel: "일자별 합계",
      buckets: Array.from({ length: 7 }, (_, index) => {
        const current = addLocalDays(weekStart, index);
        return {
          label: `${current.getMonth() + 1}/${current.getDate()}`,
          start: current.getTime(),
          end: addLocalDays(current, 1).getTime(),
        };
      }),
    };
  }

  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
  const dayCount = Math.round((monthEnd.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
  return {
    start: monthStart.getTime(),
    end: monthEnd.getTime(),
    label: `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 통계`,
    chartLabel: "일자별 합계",
    buckets: Array.from({ length: dayCount }, (_, index) => {
      const current = addLocalDays(monthStart, index);
      return {
        label: `${current.getDate()}일`,
        start: current.getTime(),
        end: addLocalDays(current, 1).getTime(),
      };
    }),
  };
}

function getRecordsInWindow(start, end) {
  return state.records.filter((record) => record.timestamp >= start && record.timestamp < end);
}

function loadRecords() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const currentRecords = Array.isArray(current) ? current.map(normalizeRecord).filter(Boolean) : [];

    const legacyRecords = LEGACY_STORAGE_KEYS.flatMap((key) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed.map(normalizeRecord).filter(Boolean) : [];
      } catch {
        return [];
      }
    });

    const mergedRecords = [...currentRecords, ...legacyRecords];
    const dedupedRecords = dedupeRecords(mergedRecords);

    if (dedupedRecords.length !== currentRecords.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupedRecords));
    }

    return dedupedRecords;
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function getBackupPayload() {
  return {
    exportedAt: new Date().toISOString(),
    records: state.records,
    settings: state.settings,
    activeSleep: state.activeSleep,
    activeBreastfeed: state.activeBreastfeed,
  };
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadHistoryFilter() {
  const saved = localStorage.getItem(HISTORY_FILTER_KEY);
  const valid = ["all", "feed", "breastfeed", "diaper", "pump", "sleep", "weight", "memo"];
  return valid.includes(saved) ? saved : "all";
}

function loadSelectedStatsDate() {
  const saved = localStorage.getItem(SELECTED_STATS_DATE_KEY);
  return /^\d{4}-\d{2}-\d{2}$/.test(saved || "") ? saved : formatDateKey(new Date());
}

function loadStatFilters() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STATS_FILTER_KEY) || "null");
  } catch {
    saved = null;
  }
  const validKeys = getStatItems().map((item) => item.key);
  const normalized = Array.isArray(saved) ? saved.filter((item) => validKeys.includes(item)) : [];
  return normalized.length ? normalized : ["feedVolume", "sleepMinutes", "weightValue"];
}

function loadActiveTab() {
  const saved = localStorage.getItem(ACTIVE_TAB_KEY);
  const valid = ["home", "stats", "history", "settings"];
  return valid.includes(saved) ? saved : "home";
}

function saveHistoryFilter() {
  localStorage.setItem(HISTORY_FILTER_KEY, state.selectedHistoryFilter);
}

function saveActiveTab() {
  localStorage.setItem(ACTIVE_TAB_KEY, state.selectedTab);
}

function saveSelectedStatsDate() {
  localStorage.setItem(SELECTED_STATS_DATE_KEY, state.selectedStatsDate);
}

function saveStatFilters() {
  localStorage.setItem(STATS_FILTER_KEY, JSON.stringify(state.selectedStatFilters));
}

function loadActiveSleep() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_SLEEP_KEY) || "null");
  } catch {
    return null;
  }
}

function loadActiveBreastfeed() {
  try {
    return normalizeActiveBreastfeed(JSON.parse(localStorage.getItem(ACTIVE_BREASTFEED_KEY) || "null"));
  } catch {
    return null;
  }
}

function saveActiveSleep() {
  if (state.activeSleep) {
    localStorage.setItem(ACTIVE_SLEEP_KEY, JSON.stringify(state.activeSleep));
  } else {
    localStorage.removeItem(ACTIVE_SLEEP_KEY);
  }
}

function saveActiveBreastfeed() {
  if (state.activeBreastfeed) {
    localStorage.setItem(ACTIVE_BREASTFEED_KEY, JSON.stringify(state.activeBreastfeed));
  } else {
    localStorage.removeItem(ACTIVE_BREASTFEED_KEY);
  }
}

function getCapacitorPlugins() {
  const capacitor = window.Capacitor;
  const plugins = capacitor?.Plugins;
  return {
    capacitor,
    filesystem: plugins?.Filesystem ?? null,
    share: plugins?.Share ?? null,
  };
}

function isNativeApp() {
  const { capacitor } = getCapacitorPlugins();
  if (!capacitor) {
    return false;
  }
  if (typeof capacitor.isNativePlatform === "function") {
    return capacitor.isNativePlatform();
  }
  return typeof capacitor.getPlatform === "function" ? capacitor.getPlatform() !== "web" : false;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 1800);
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatLongDate(dateLike) {
  const date = new Date(dateLike);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatDateKey(dateLike) {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatSleep(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  if (hour && minute) {
    return `${hour}시간 ${minute}분`;
  }

  if (hour) {
    return `${hour}시간`;
  }

  return `${minute}분`;
}

function getRecordDurationMinutes(record) {
  if (Number.isFinite(Number(record.durationMinutes)) && Number(record.durationMinutes) > 0) {
    return Number(record.durationMinutes);
  }

  if (Number.isFinite(Number(record.start)) && Number.isFinite(Number(record.end)) && Number(record.end) >= Number(record.start)) {
    return Math.max(1, Math.round((Number(record.end) - Number(record.start)) / 60000));
  }

  return 0;
}

function formatElapsedHms(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function mapValue(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) {
    return outMin;
  }
  return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function truncateWeightValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.trunc(parsed * 1000) / 1000;
}

function formatWeightValue(value) {
  const parsed = truncateWeightValue(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return parsed.toFixed(3).replace(/\.?0+$/, "");
}

function sanitizeWeightInput(value) {
  if (!value) {
    return "";
  }
  const parsed = Number(value);
  if (!parsed || parsed < 0) {
    return "";
  }

  const [rawIntegerPart = "0", rawDecimalPart = ""] = String(value).trim().split(".");
  const integerPart = String(Math.trunc(parsed));
  const decimalPart = rawDecimalPart.replace(/\D/g, "").slice(0, 3);

  if (!decimalPart) {
    return integerPart;
  }

  return `${integerPart}.${decimalPart}`.replace(/\.?0+$/, "");
}

async function exportRecords() {
  const payload = getBackupPayload();
  const filename = `baby-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const content = JSON.stringify(payload, null, 2);

  if (isNativeApp()) {
    const { filesystem, share } = getCapacitorPlugins();
    if (!filesystem) {
      showToast("앱 백업 기능을 사용할 수 없습니다");
      return;
    }

    try {
      const directory = filesystem.Directory?.Documents ?? filesystem.Directory?.Data ?? "DOCUMENTS";
      const encoding = filesystem.Encoding?.UTF8 ?? "utf8";
      const path = `${CAPACITOR_BACKUP_DIR}/${filename}`;
      await filesystem.writeFile({
        path,
        data: content,
        directory,
        encoding,
        recursive: true,
      });

      if (share) {
        const uriResult = await filesystem.getUri({ path, directory });
        await share.share({
          title: "Baby Log Backup",
          text: "육아 기록 백업 파일입니다.",
          url: uriResult.uri,
          dialogTitle: "백업 파일 공유",
        });
      }

      showToast("백업 파일을 저장했습니다");
      return;
    } catch {
      showToast("앱 백업 파일 저장에 실패했습니다");
      return;
    }
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("백업 파일을 내보냈습니다");
}

function triggerImport() {
  elements.importFile.value = "";
  elements.importFile.click();
}

function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const importedRecords = Array.isArray(parsed.records) ? parsed.records.map(normalizeRecord).filter(Boolean) : [];
      if (!importedRecords.length) {
        showToast("가져올 기록이 없습니다");
        return;
      }
      state.records = dedupeRecords([...importedRecords, ...state.records]).sort((a, b) => b.timestamp - a.timestamp);
      if (parsed.settings && typeof parsed.settings === "object") {
        state.settings = { ...state.settings, ...parsed.settings };
        saveSettings();
        hydrateInputs();
        renderDefaultOptions();
      }
      if (parsed.activeSleep && typeof parsed.activeSleep.start === "number") {
        state.activeSleep = parsed.activeSleep;
        saveActiveSleep();
      }
      if (parsed.activeBreastfeed && typeof parsed.activeBreastfeed.start === "number") {
        state.activeBreastfeed = normalizeActiveBreastfeed(parsed.activeBreastfeed);
        saveActiveBreastfeed();
      }
      saveRecords();
      render();
      showToast("백업 데이터를 가져왔습니다");
    } catch {
      showToast("백업 파일을 읽지 못했습니다");
    }
  };
  reader.readAsText(file);
}

function computeAverageFeedInterval(feeds) {
  if (feeds.length < 2) {
    return null;
  }
  const ordered = [...feeds].sort((a, b) => a.timestamp - b.timestamp);
  const intervals = [];
  for (let index = 1; index < ordered.length; index += 1) {
    intervals.push((ordered[index].timestamp - ordered[index - 1].timestamp) / (1000 * 60 * 60));
  }
  return intervals.reduce((sum, item) => sum + item, 0) / intervals.length;
}

function toggleStatFilter(filterKey) {
  const active = state.selectedStatFilters.includes(filterKey);
  if (active && state.selectedStatFilters.length === 1) {
    showToast("통계 항목은 하나 이상 선택되어야 합니다");
    return;
  }

  state.selectedStatFilters = active
    ? state.selectedStatFilters.filter((item) => item !== filterKey)
    : [...state.selectedStatFilters, filterKey];
  saveStatFilters();
  renderStats();
}

function shiftCalendarMonth(offset) {
  const current = parseDateKey(state.selectedStatsDate);
  const shifted = new Date(current.getFullYear(), current.getMonth() + offset, 1);
  const nextDate = new Date(shifted.getFullYear(), shifted.getMonth(), Math.min(current.getDate(), getDaysInMonth(shifted)));
  state.selectedStatsDate = formatDateKey(nextDate);
  saveSelectedStatsDate();
  renderStats();
}

function selectTodayForStats() {
  state.selectedStatsDate = formatDateKey(new Date());
  saveSelectedStatsDate();
  renderStats();
}

function computeRangeSleepAverage(range) {
  const now = new Date();
  const samples = [];

  if (range === "day") {
    for (let offset = 1; offset <= 3; offset += 1) {
      const start = addLocalDays(startOfLocalDay(now), -offset);
      samples.push(sumSleepHours(start.getTime(), start.getTime() + 24 * 60 * 60 * 1000));
    }
  } else if (range === "week") {
    for (let offset = 1; offset <= 3; offset += 1) {
      const end = addLocalDays(startOfLocalDay(now), -offset * 7 + 1);
      const start = addLocalDays(end, -6);
      samples.push(sumSleepHours(start.getTime(), end.getTime() + 24 * 60 * 60 * 1000));
    }
  } else {
    return null;
  }

  const validSamples = samples.filter((value) => value > 0);
  if (!validSamples.length) {
    return null;
  }
  return roundOne(validSamples.reduce((sum, item) => sum + item, 0) / validSamples.length);
}

function sumSleepHours(start, end) {
  return roundOne(
    state.records
      .filter((record) => record.type === "sleep" && record.timestamp >= start && record.timestamp < end)
      .reduce((sum, record) => sum + Number(record.durationMinutes || 0), 0) / 60
  );
}

function formatDelta(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${roundOne(value).toFixed(1)}시간`;
}

function toDatetimeLocal(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value) {
  return new Date(value).getTime();
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dedupeRecords(records) {
  const seen = new Set();

  return records.filter((record) => {
    const fingerprint = record.id
      ? `id:${record.id}`
      : [
          record.type,
          record.timestamp,
          record.amount ?? "",
          record.status ?? "",
          record.start ?? "",
          record.end ?? "",
          record.weight ?? "",
          record.text ?? "",
        ].join("|");

    if (seen.has(fingerprint)) {
      return false;
    }

    seen.add(fingerprint);
    return true;
  });
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object" || !record.type) {
    return null;
  }

  const normalized = {
    ...record,
    timestamp: Number(record.timestamp),
  };

  if (!Number.isFinite(normalized.timestamp)) {
    return null;
  }

  if (record.type === "feed") {
    normalized.amount = Number(record.amount);
    if (!Number.isFinite(normalized.amount)) {
      return null;
    }
  }

  if (record.type === "pump") {
    normalized.amount = Number(record.amount);
    if (!Number.isFinite(normalized.amount)) {
      return null;
    }
  }

  if (record.type === "diaper") {
    normalized.status = String(record.status || "");
  }

  if (record.type === "sleep" || record.type === "breastfeed") {
    normalized.start = Number(record.start);
    normalized.end = Number(record.end);
    normalized.durationMinutes = Number.isFinite(Number(record.durationMinutes))
      ? Number(record.durationMinutes)
      : Math.max(1, Math.round((normalized.end - normalized.start) / 60000));
    if (![normalized.start, normalized.end].every(Number.isFinite)) {
      return null;
    }
    if (!Number.isFinite(normalized.durationMinutes)) {
      return null;
    }
  }

  if (record.type === "weight") {
    normalized.weight = Number(record.weight);
    if (!Number.isFinite(normalized.weight)) {
      return null;
    }
  }

  if (record.type === "memo") {
    normalized.text = String(record.text || "");
  }

  return normalized;
}

function createActiveBreastfeedSession(start) {
  return {
    start,
    isPaused: false,
    pausedAt: null,
    pausedDurationMs: 0,
  };
}

function normalizeActiveBreastfeed(session) {
  if (!session || typeof session.start !== "number") {
    return null;
  }

  return {
    start: Number(session.start),
    isPaused: Boolean(session.isPaused),
    pausedAt: Number.isFinite(Number(session.pausedAt)) ? Number(session.pausedAt) : null,
    pausedDurationMs: Number.isFinite(Number(session.pausedDurationMs)) ? Number(session.pausedDurationMs) : 0,
  };
}

function getBreastfeedElapsedMs(now = Date.now()) {
  if (!state.activeBreastfeed) {
    return 0;
  }

  const effectiveEnd = state.activeBreastfeed.isPaused ? state.activeBreastfeed.pausedAt ?? now : now;
  return Math.max(0, effectiveEnd - state.activeBreastfeed.start - state.activeBreastfeed.pausedDurationMs);
}

function createDraftRecord(type) {
  const timestamp = Date.now();

  if (type === "feed") {
    return { type, timestamp, amount: Number(state.settings.feedAmount) };
  }

  if (type === "diaper") {
    return { type, timestamp, status: state.settings.diaperStatus };
  }

  if (type === "weight") {
    return { type, timestamp, weight: state.settings.weightValue ? Number(state.settings.weightValue) : "" };
  }

  if (type === "pump") {
    return { type, timestamp, amount: Number(state.settings.pumpAmount) };
  }

  return { type: "memo", timestamp, text: elements.memoInput.value.trim() };
}

function getTypeLabel(type) {
  const labels = {
    feed: "분유",
    breastfeed: "모유수유",
    diaper: "기저귀",
    sleep: "수면",
    weight: "몸무게",
    pump: "유축",
    memo: "메모",
  };
  return labels[type] ?? "기록";
}

function syncRecentSettings(record) {
  if (record.type === "feed" && Number.isFinite(Number(record.amount)) && Number(record.amount) > 0) {
    state.settings.feedAmount = Number(record.amount);
    elements.feedInput.value = "";
  }

  if (record.type === "pump" && Number.isFinite(Number(record.amount)) && Number(record.amount) > 0) {
    state.settings.pumpAmount = Number(record.amount);
    elements.pumpInput.value = "";
  }

  if (record.type === "diaper" && record.status) {
    state.settings.diaperStatus = String(record.status);
  }

  if (record.type === "weight" && Number.isFinite(Number(record.weight)) && Number(record.weight) > 0) {
    state.settings.weightValue = formatWeightValue(record.weight);
    elements.weightInput.value = state.settings.weightValue;
  }

  saveSettings();
  renderDefaultOptions();
}

function startOfLocalDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addLocalDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStartOfWeek(dateLike, mondayFirst = true) {
  const date = startOfLocalDay(dateLike);
  const day = date.getDay();
  const diff = mondayFirst ? (day === 0 ? -6 : 1 - day) : -day;
  return addLocalDays(date, diff);
}

function getDaysInMonth(dateLike) {
  const date = new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function normalizeMetricValue(metricKey, value) {
  if (value === null || value === undefined) {
    return metricKey === "weightValue" ? null : 0;
  }

  if (metricKey === "breastfeedMinutes" || metricKey === "sleepMinutes") {
    return roundOne(Number(value) / 60);
  }

  return Number(value);
}
