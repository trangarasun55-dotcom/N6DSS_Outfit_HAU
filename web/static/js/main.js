document.addEventListener('DOMContentLoaded', function () {
    const today = new Date();
    const dateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long'
    }).formatToParts(today);
    const weekdayEnglish = dateParts.find(function (part) { return part.type === 'weekday'; }).value;
    const weekdayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(weekdayEnglish);
    const weekday = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][weekdayIndex];
    const dateLabel = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(today);
    const dateNode = document.getElementById('todayDate');
    if (dateNode) dateNode.textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    const sidebarWeekday = document.getElementById('sidebarWeekday');
    if (sidebarWeekday) sidebarWeekday.textContent = weekday;
    const todayScheduleRows = document.querySelectorAll('[data-schedule-day]');
    if (todayScheduleRows.length) {
        let visibleCount = 0;
        todayScheduleRows.forEach(function (row) {
            const isToday = row.dataset.scheduleDay.trim() === weekday;
            row.hidden = !isToday;
            if (isToday) visibleCount += 1;
        });
        const countBadge = document.getElementById('scheduleCount');
        if (countBadge) countBadge.textContent = visibleCount + ' tiết';
        const emptyToday = document.getElementById('scheduleEmptyToday');
        if (emptyToday) emptyToday.hidden = visibleCount > 0;
    }

    const activityCards = document.querySelectorAll('.activity-card');
    const continueButton = document.getElementById('btnContinue');
    const hint = document.getElementById('actionHint');
    const genderInputs = document.querySelectorAll('input[name="gender"]');
    function syncActivityState() {
        const selectedActivity = document.querySelector('input[name="activity"]:checked');
        const selectedGender = document.querySelector('input[name="gender"]:checked');
        const tempNode = document.getElementById('activityTemperature');
        const validTemperature = Boolean(tempNode && tempNode.value.trim() !== '' && Number.isFinite(Number(tempNode.value)) && Number(tempNode.value) >= -10 && Number(tempNode.value) <= 50);
        const canContinue = Boolean(selectedActivity && selectedGender && validTemperature);
        if (continueButton) continueButton.disabled = !canContinue;
        if (hint) hint.textContent = !selectedActivity && !selectedGender
            ? 'Vui lòng chọn hoạt động và giới tính'
            : (!selectedActivity ? 'Vui lòng chọn một hoạt động để tiếp tục'
                : (!selectedGender ? 'Vui lòng chọn giới tính để tiếp tục' : (!validTemperature ? 'Nhập nhiệt độ thật hoặc nhiệt độ thủ công (-10 đến 50°C)' : 'Đã chọn: ' + selectedActivity.value + '. Bạn có thể tiếp tục.')));
        const sidebarActivity = document.getElementById('sidebarActivity');
        if (sidebarActivity) sidebarActivity.textContent = (selectedActivity ? selectedActivity.value : 'Chưa chọn hoạt động') + ' · ' + weekday;
    }

    activityCards.forEach(function (card) {
        const radio = card.querySelector('input[type="radio"]');
        radio.addEventListener('change', function () {
            activityCards.forEach(function (item) { item.classList.remove('selected'); });
            card.classList.add('selected');
            syncActivityState();
        });
    });
    genderInputs.forEach(function (input) { input.addEventListener('change', syncActivityState); });
    syncActivityState();

    const rows = document.getElementById('scheduleRows');
    const addRowButton = document.getElementById('addScheduleRow');
    document.querySelectorAll('.schedule-actions a').forEach(function (link) {
        link.addEventListener('click', function () {
            const editor = document.getElementById('scheduleEditor');
            if (editor) editor.open = true;
        });
    });
    if (rows && addRowButton) {
        addRowButton.addEventListener('click', function () {
            const template = rows.querySelector('.schedule-row');
            if (!template) return;
            const row = template.cloneNode(true);
            row.querySelectorAll('input').forEach(function (input) { input.value = ''; });
            row.querySelectorAll('select').forEach(function (select, index) { select.selectedIndex = 0; });
            rows.appendChild(row);
        });
        rows.addEventListener('click', function (event) {
            const removeButton = event.target.closest('.remove-row-button');
            if (removeButton && rows.querySelectorAll('.schedule-row').length > 1) removeButton.closest('.schedule-row').remove();
        });
    }

    document.querySelectorAll('input[name="schedule_image"]').forEach(function (input) {
        input.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                this.setCustomValidity('Chọn ảnh PNG, JPG hoặc WEBP có kích thước tối đa 5 MB.');
            } else this.setCustomValidity('');
        });
    });

    const refreshWeather = document.getElementById('refreshWeather');
    if (refreshWeather) {
        refreshWeather.addEventListener('click', async function () {
            const status = document.getElementById('weatherStatus');
            const reading = document.getElementById('weatherReading');
            const city = document.getElementById('weatherCity').value.trim() || 'Hà Nội';
            refreshWeather.disabled = true;
            status.textContent = 'Đang lấy dữ liệu thời tiết…';
            try {
                const response = await fetch('/ui/weather?city=' + encodeURIComponent(city), { signal: AbortSignal.timeout(13000) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || result.detail || result.error || 'Không lấy được thời tiết.');
                const temperature = result.temp_current;
                const modelTemperature = result.temperature_for_model == null ? temperature : result.temperature_for_model;
                reading.dataset.temperature = modelTemperature;
                reading.innerHTML = '';
                reading.append(document.createTextNode(temperature + '°'));
                const unit = document.createElement('span'); unit.textContent = ' C'; reading.append(unit);
                status.textContent = result.condition_text + ' · ' + result.city;
                status.dataset.condition = result.condition_text || '';
                status.dataset.city = result.city || '';
                document.getElementById('manualTemperature').value = modelTemperature;
                const activityTemperature = document.getElementById('activityTemperature');
                if (activityTemperature) activityTemperature.value = modelTemperature;
                const feelsLike = document.getElementById('feelsLike');
                if (feelsLike && result.feels_like !== null && result.feels_like !== undefined) feelsLike.textContent = result.feels_like + '°C';
                const humidity = document.getElementById('humidity');
                if (humidity) humidity.textContent = result.humidity == null ? '—' : result.humidity + '%';
                const wind = document.getElementById('windSpeed');
                if (wind) wind.textContent = result.wind_kmh == null ? '—' : result.wind_kmh + ' km/h';
                const rain = document.getElementById('rainAlert');
                if (rain) { rain.hidden = !result.rain_alert; rain.textContent = result.rain_alert ? result.rain_alert.text : ''; }
                const sidebarWeather = document.getElementById('sidebarWeather');
                if (sidebarWeather) sidebarWeather.textContent = temperature + '°C · ' + result.city;
                syncActivityState();
            } catch (error) {
                status.textContent = error.name === 'TimeoutError' ? 'Yêu cầu thời tiết hết thời gian. Bạn có thể nhập nhiệt độ thủ công.' : (error.message || 'Không lấy được thời tiết. Bạn có thể nhập nhiệt độ thủ công.');
                if (reading) { reading.textContent = ''; const empty = document.createElement('span'); empty.className = 'weather-empty'; empty.textContent = 'Không có dữ liệu'; reading.append(empty); }
            } finally {
                refreshWeather.disabled = false;
            }
        });
        refreshWeather.click();
    }

    const manualTemperature = document.getElementById('manualTemperature');
    if (manualTemperature) manualTemperature.addEventListener('input', function () {
        const activityTemperature = document.getElementById('activityTemperature');
        if (activityTemperature) activityTemperature.value = this.value;
        const source = document.getElementById('temperatureSource');
        if (source) source.value = 'manual';
        const sidebarWeather = document.getElementById('sidebarWeather');
        if (sidebarWeather && this.value !== '') sidebarWeather.textContent = this.value + '°C · đã chỉnh tay';
        const weatherCaption = document.getElementById('weatherStatus');
        if (weatherCaption && this.value !== '') {
            weatherCaption.dataset.manual = 'true';
            weatherCaption.textContent = 'Đã chỉnh tay · ' + (weatherCaption.dataset.city || 'địa điểm đã chọn');
        }
        syncActivityState();
    });
    const liveTemperatureButton = document.getElementById('useLiveTemperature');
    if (liveTemperatureButton) liveTemperatureButton.addEventListener('click', function () {
        const source = document.getElementById('temperatureSource');
        const manual = document.getElementById('manualTemperature');
        const status = document.getElementById('weatherStatus');
        if (source) source.value = 'live';
        if (manual) manual.value = '';
        if (status) {
            status.dataset.manual = 'false';
            if (status.dataset.condition) status.textContent = status.dataset.condition + ' · ' + status.dataset.city;
        }
        const activityTemperature = document.getElementById('activityTemperature');
        const reading = document.getElementById('weatherReading');
        const weatherValue = reading && reading.dataset.temperature;
        if (activityTemperature) activityTemperature.value = weatherValue || '';
        const sidebarWeather = document.getElementById('sidebarWeather');
        if (sidebarWeather && weatherValue) sidebarWeather.textContent = weatherValue + '°C · ' + (status.textContent.split(' · ').pop() || '');
        syncActivityState();
    });

    const chips = document.querySelectorAll('.chip-item');
    chips.forEach(function (chip) {
        chip.addEventListener('click', function (event) {
            event.preventDefault();
            const checkbox = chip.querySelector('input[type="checkbox"]');
            const selected = !chip.classList.contains('selected');
            chip.classList.toggle('selected', selected);
            if (checkbox) checkbox.checked = selected;
            scheduleLivePreview();
        });
    });

    document.querySelectorAll('.color-dot').forEach(function (dot) {
        dot.addEventListener('click', function (event) {
            event.preventDefault();
            const checkbox = dot.querySelector('input[type="checkbox"]');
            const selected = !dot.classList.contains('selected');
            dot.classList.toggle('selected', selected);
            if (checkbox) checkbox.checked = selected;
            dot.textContent = selected ? '✓' : '';
            scheduleLivePreview();
        });
    });

    const comfortRange = document.getElementById('comfortRange');
    const rangePercent = document.getElementById('rangePercent');
    if (comfortRange && rangePercent) {
        comfortRange.addEventListener('input', function () {
            rangePercent.textContent = this.value + '%';
            const previewFormality = document.getElementById('previewFormality');
            if (previewFormality) previewFormality.textContent = this.value + '%';
            scheduleLivePreview();
        });
    }

    // Debounced live recommendation preview. It calls a non-persistent API route,
    // so moving sliders or toggling chips does not create noisy history records.
    const styleForm = document.getElementById('styleForm');
    const previewResults = document.getElementById('liveOutfitResults');
    const previewStatus = document.getElementById('previewStatus');
    const previewMessage = document.getElementById('previewMessage');
    let previewTimer = null;
    let previewController = null;
    let previewSequence = 0;
    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
        });
    }
    function selectedValues(name) {
        return Array.from(styleForm.querySelectorAll('input[name="' + name + '"]:checked')).map(function (el) { return el.value; });
    }
    function updatePreviewSummary() {
        const styles = selectedValues('styles');
        const colors = selectedValues('colors');
        const stylesNode = document.getElementById('previewStyles');
        const colorsNode = document.getElementById('previewColors');
        const temperatureNode = document.getElementById('previewTemperature');
        const weatherNode = document.getElementById('previewWeather');
        if (stylesNode) stylesNode.textContent = styles.length ? styles.join(', ') : 'AI tự cân bằng';
        if (colorsNode) colorsNode.textContent = colors.length ? colors.join(', ') : 'Tất cả màu phù hợp';
        if (weatherNode && temperatureNode) weatherNode.textContent = temperatureNode.value + '°C';
    }
    function scheduleLivePreview() {
        if (!styleForm || !previewResults || !previewStatus) return;
        updatePreviewSummary();
        if (previewTimer) window.clearTimeout(previewTimer);
        previewTimer = window.setTimeout(runLivePreview, 650);
    }
    async function runLivePreview() {
        if (!styleForm || !previewResults || !previewStatus) return;
        const sequence = ++previewSequence;
        if (previewController) previewController.abort();
        previewController = new AbortController();
        const temperature = Number((document.getElementById('previewTemperature') || {}).value || 25);
        const formData = new FormData(styleForm);
        const payload = {
            temperature: temperature,
            styles: selectedValues('styles'),
            colors: selectedValues('colors'),
            formality: Number(formData.get('formality') || 35),
            notes: String(formData.get('notes') || '').slice(0, 300)
        };
        previewStatus.textContent = 'AI đang phân tích…';
        previewStatus.className = 'preview-status is-loading';
        previewResults.innerHTML = '<div class="preview-empty">Đang kiểm tra lại tiêu chí và tìm các bộ outfit khác nhau…</div>';
        try {
            const response = await fetch('/ui/recommend-preview', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload), signal: previewController.signal
            });
            const data = await response.json();
            if (sequence !== previewSequence) return;
            if (!response.ok) throw new Error(data.message || data.detail || 'Không tạo được bản xem trước.');
            const outfits = Array.isArray(data.outfits) ? data.outfits : [];
            if (!outfits.length) {
                previewResults.innerHTML = '<div class="preview-empty">Chưa tìm được bộ outfit phù hợp với tổ hợp tiêu chí này. Hãy thử đổi phong cách, màu hoặc mức trang trọng.</div>';
            } else {
                previewResults.innerHTML = outfits.map(function (outfit, index) {
                    const items = Array.isArray(outfit.items) ? outfit.items : [];
                    const itemChips = items.map(function (item) {
                        const name = item.name || item['Tên sản phẩm'] || item.category || 'Trang phục';
                        const color = item.color || item['Màu sắc'] || '';
                        return '<span class="outfit-item-chip">' + escapeHtml(color ? color + ' · ' + name : name) + '</span>';
                    }).join('');
                    const explain = outfit.explanation_llm || outfit.explanation || outfit.recommendation || '';
                    return '<article class="live-outfit-card"><h3>' + escapeHtml(outfit.name || ('Bộ outfit ' + (index + 1))) + '</h3>' +
                        '<p class="outfit-score">Độ phù hợp: ' + escapeHtml(outfit.match_score == null ? '—' : outfit.match_score + '%') + '</p>' +
                        '<div class="outfit-item-chips">' + itemChips + '</div><p>' + escapeHtml(explain) + '</p></article>';
                }).join('');
            }
            previewStatus.textContent = 'Đã cập nhật';
            previewStatus.className = 'preview-status';
            if (previewMessage) {
                const notes = payload.notes.trim();
                previewMessage.textContent = notes ? 'Ghi chú đã được gửi cho AI phân tích cùng phong cách, màu sắc và mức trang trọng. Các giới hạn không có trong dữ liệu sản phẩm có thể cần kiểm tra thủ công.' : 'AI đã đánh giá lại phong cách, màu sắc, mức thoải mái/trang trọng và thời tiết. Bản xem trước không được lưu vào lịch sử.';
            }
        } catch (error) {
            if (error.name === 'AbortError' || sequence !== previewSequence) return;
            previewStatus.textContent = 'Chưa cập nhật';
            previewStatus.className = 'preview-status is-error';
            previewResults.innerHTML = '<div class="preview-empty">' + escapeHtml(error.message || 'Không kết nối được AI preview.') + '</div>';
            if (previewMessage) previewMessage.textContent = 'Bạn vẫn có thể bấm “Tạo và lưu bộ outfit chính thức” để thử tạo kết quả.';
        }
    }
    if (styleForm) {
        styleForm.querySelectorAll('input[name="styles"], input[name="colors"], textarea[name="notes"]').forEach(function (field) {
            field.addEventListener('change', scheduleLivePreview);
            field.addEventListener('input', scheduleLivePreview);
        });
        scheduleLivePreview();
    }

    const recommendationForm = document.getElementById('recommendationForm');
    if (recommendationForm) {
        recommendationForm.addEventListener('submit', function () {
            const button = document.getElementById('recommendationSubmit');
            if (button) {
                button.disabled = true;
                button.textContent = 'Đang nhận gợi ý…';
            }
            let spinner = document.getElementById('recommendationSpinner');
            if (!spinner) {
                spinner = document.createElement('div');
                spinner.id = 'recommendationSpinner';
                spinner.className = 'loading-spinner';
                spinner.setAttribute('role', 'status');
                spinner.setAttribute('aria-label', 'Đang tạo gợi ý');
                recommendationForm.insertAdjacentElement('beforebegin', spinner);
            }
            spinner.hidden = false;
        });
    }

    const trackedOutfit = document.querySelector('[data-outfit-tracking]');
    if (trackedOutfit && trackedOutfit.dataset.requestItemId) {
        const requestItemId = Number(trackedOutfit.dataset.requestItemId);
        let viewId = null;
        let heartbeatTimer = null;
        let ending = false;
        async function startViewing() {
            if (!Number.isInteger(requestItemId) || document.visibilityState !== 'visible') return;
            try {
                const response = await fetch('/ui/events/view', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start', request_item_id: requestItemId }),
                    signal: AbortSignal.timeout(8000)
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Không ghi nhận được lượt xem.');
                viewId = payload.view_id;
                ending = false;
                if (heartbeatTimer) window.clearInterval(heartbeatTimer);
                heartbeatTimer = window.setInterval(sendHeartbeat, 15000);
            } catch (error) {
                viewId = null;
            }
        }
        async function sendHeartbeat() {
            if (!viewId || document.visibilityState !== 'visible') return;
            try {
                const response = await fetch('/ui/events/view', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'heartbeat', view_id: viewId }),
                    signal: AbortSignal.timeout(8000)
                });
                const payload = await response.json();
                if (!response.ok || payload.ended) endViewing(false);
            } catch (error) {
                // The API caps durations; a missed heartbeat is safe to retry.
            }
        }
        function endViewing(useBeacon) {
            if (!viewId || ending) return;
            ending = true;
            const endedViewId = viewId;
            viewId = null;
            if (heartbeatTimer) window.clearInterval(heartbeatTimer);
            const body = JSON.stringify({ action: 'end', view_id: endedViewId });
            if (useBeacon && navigator.sendBeacon) {
                navigator.sendBeacon('/ui/events/view', new Blob([body], { type: 'application/json' }));
                return;
            }
            fetch('/ui/events/view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body,
                keepalive: true
            }).catch(function () {});
        }
        startViewing();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') endViewing(false);
            else if (!viewId) startViewing();
        });
        window.addEventListener('pagehide', function () { endViewing(true); });
    }

    const actionStatus = document.getElementById('outfitActionStatus');
    function showOutfitActionStatus(message, isError) {
        if (!actionStatus) return;
        actionStatus.hidden = false;
        actionStatus.textContent = message;
        actionStatus.classList.toggle('error-notice', Boolean(isError));
        actionStatus.classList.toggle('success-notice', !isError);
    }
    document.querySelectorAll('[data-finalize-outfit]').forEach(function (button) {
        button.addEventListener('click', async function () {
            const outfitId = button.dataset.finalizeOutfit;
            const finalized = button.getAttribute('aria-pressed') === 'true';
            const note = document.getElementById('outfitNote');
            button.disabled = true;
            try {
                const response = await fetch('/ui/outfits/' + encodeURIComponent(outfitId) + '/finalize', {
                    method: finalized ? 'DELETE' : 'POST',
                    headers: finalized ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: finalized ? undefined : new URLSearchParams({ note: note ? note.value : '' }),
                    signal: AbortSignal.timeout(10000)
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Chưa lưu được lựa chọn.');
                button.setAttribute('aria-pressed', String(!finalized));
                button.textContent = finalized ? 'Chốt trang phục này' : 'Đã chốt · Hủy chốt';
                showOutfitActionStatus(finalized ? 'Đã hủy chốt trang phục.' : 'Đã ghi nhận bạn chốt trang phục này.', false);
            } catch (error) {
                showOutfitActionStatus(error.message || 'Không kết nối được máy chủ gợi ý.', true);
            } finally {
                button.disabled = false;
            }
        });
    });
    document.querySelectorAll('[data-outfit-feedback]').forEach(function (button) {
        button.addEventListener('click', async function () {
            const outfitId = button.dataset.outfitFeedback;
            const value = Number(button.dataset.feedbackValue);
            button.disabled = true;
            try {
                const response = await fetch('/ui/outfits/' + encodeURIComponent(outfitId) + '/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: value }),
                    signal: AbortSignal.timeout(10000)
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Chưa lưu được đánh giá.');
                showOutfitActionStatus(value === 1 ? 'Đã ghi nhận đánh giá hữu ích.' : 'Đã ghi nhận đánh giá không hữu ích.', false);
            } catch (error) {
                showOutfitActionStatus(error.message || 'Không kết nối được máy chủ gợi ý.', true);
            } finally {
                button.disabled = false;
            }
        });
    });

    const historyRange = document.getElementById('historyRange');
    const historyFrom = document.getElementById('historyFrom');
    const historyTo = document.getElementById('historyTo');
    function syncHistoryDateInputs() {
        const custom = historyRange && historyRange.value === 'from-to';
        [historyFrom, historyTo].forEach(function (input) {
            if (!input) return;
            input.disabled = !custom;
            input.required = Boolean(custom);
        });
    }
    if (historyRange) {
        historyRange.addEventListener('change', syncHistoryDateInputs);
        syncHistoryDateInputs();
    }

    const vietnamDateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    function localDateKey(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const parts = vietnamDateParts.formatToParts(date);
        const part = function (name) { return parts.find(function (item) { return item.type === name; }).value; };
        return part('year') + '-' + part('month') + '-' + part('day');
    }
    const localDateTimeFormat = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    document.querySelectorAll('time.local-datetime').forEach(function (node) {
        const date = new Date(node.dateTime);
        if (!node.dateTime || Number.isNaN(date.getTime())) {
            node.textContent = '—';
            return;
        }
        const parts = localDateTimeFormat.formatToParts(date);
        const part = function (name) { return parts.find(function (item) { return item.type === name; }).value; };
        node.textContent = part('day') + '/' + part('month') + '/' + part('year') + ' ' + part('hour') + ':' + part('minute');
    });

    const historyList = document.querySelector('.history-list');
    if (historyList) {
        const todayKey = localDateKey(new Date().toISOString());
        const yesterdayKey = todayKey
            ? new Date(Date.parse(todayKey + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
            : null;
        let previousKey = null;
        historyList.querySelectorAll('[data-history-entry]').forEach(function (entry) {
            const key = localDateKey(entry.dataset.createdAt);
            if (!key) {
                const heading = document.createElement('h2');
                heading.className = 'history-day-heading';
                heading.textContent = 'Ngày không xác định';
                historyList.insertBefore(heading, entry);
                previousKey = null;
                return;
            }
            if (key !== previousKey) {
                const heading = document.createElement('h2');
                heading.className = 'history-day-heading';
                heading.textContent = key === todayKey ? 'Hôm nay'
                    : (key === yesterdayKey ? 'Hôm qua' : key.split('-').reverse().join('/'));
                historyList.insertBefore(heading, entry);
                previousKey = key;
            }
        });
    }

    const chart = document.getElementById('adminActivityChart');
    const chartDataNode = document.getElementById('adminChartData');
    if (chart && chartDataNode) {
        try {
            const data = JSON.parse(chartDataNode.textContent || '{}');
            const period = document.getElementById('adminPeriod').value;
            const bucketKey = function (value) {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return null;
                if (period === 'day') {
                    return new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23'
                    }).format(date);
                }
                return localDateKey(value);
            };
            const totals = {};
            [['viewed', 'views'], ['finalized', 'finalized'], ['feedback', 'helpful']].forEach(function (pair) {
                (data[pair[0]] || []).forEach(function (item) {
                    const key = bucketKey(item.created_at);
                    if (!key) return;
                    if (!totals[key]) totals[key] = { views: 0, finalized: 0, helpful: 0, ratings: 0 };
                    if (pair[0] === 'feedback') {
                        totals[key].ratings += 1;
                        if (item.feedback && item.feedback.value === 1) totals[key].helpful += 1;
                    } else {
                        totals[key][pair[1]] += 1;
                    }
                });
            });
            const keys = Object.keys(totals).sort();
            if (!keys.length) {
                chart.textContent = 'Khoảng thời gian này chưa có sự kiện.';
            } else {
                const series = [
                    { key: 'views', className: 'legend-view', scale: Math.max.apply(null, keys.map(function (key) { return totals[key].views; }).concat([1])) },
                    { key: 'finalized', className: 'legend-final', scale: Math.max.apply(null, keys.map(function (key) { return totals[key].finalized; }).concat([1])) },
                    { key: 'helpful', className: 'legend-like', scale: 100 }
                ];
                keys.forEach(function (key) {
                    const group = document.createElement('div');
                    group.className = 'chart-group';
                    const bars = document.createElement('div');
                    bars.className = 'chart-bars';
                    series.forEach(function (entry) {
                        const bar = document.createElement('div');
                        bar.className = 'chart-bar ' + entry.className;
                        const count = entry.key === 'helpful'
                            ? (totals[key].ratings ? Math.round(totals[key].helpful / totals[key].ratings * 100) : 0)
                            : totals[key][entry.key];
                        bar.style.height = count === 0 ? '3px' : Math.max(3, count / entry.scale * 100) + '%';
                        bar.title = entry.key === 'helpful' ? count + '% đánh giá hữu ích' : count + ' sự kiện';
                        bar.setAttribute('aria-label', bar.title);
                        bars.appendChild(bar);
                    });
                    group.appendChild(bars);
                    const label = document.createElement('span');
                    label.className = 'chart-label';
                    label.textContent = period === 'day' ? key + 'h' : key.split('-').slice(1).reverse().join('/');
                    group.appendChild(label);
                    chart.appendChild(group);
                });
            }
        } catch (error) {
            chart.textContent = 'Không thể hiển thị biểu đồ.';
        }
    }
});
