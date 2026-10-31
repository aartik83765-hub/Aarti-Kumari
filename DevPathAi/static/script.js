const $ = (selector) => document.querySelector(selector);

let currentProfile = null;
let currentSkills = null;
let currentCareers = [];
let currentGoals = [];


async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Something went wrong.");
    }

    return result;
}


function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
}


function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// ---------------- SKILL SLIDERS ----------------

["html", "css", "javascript", "python", "java"].forEach(skill => {
    const slider = $("#" + skill);
    const output = $("#" + skill + "Value");

    slider.addEventListener("input", () => {
        output.textContent = slider.value + "%";
    });
});


// ---------------- PROFILE ----------------

$("#profileForm").addEventListener("submit", async event => {
    event.preventDefault();

    const message = $("#profileMessage");

    try {
        const result = await api("/api/profile", {
            method: "POST",
            body: JSON.stringify({
                name: $("#studentName").value.trim(),
                course: $("#course").value.trim(),
                interests: $("#interests").value
            })
        });

        currentProfile = result;

        $("#profileForm").querySelector("button").textContent =
            "Create Another Profile →";

        showMessage(
            message,
            "Welcome, " + result.name + "! Your profile is ready."
        );

        await refreshDashboard();

    } catch (error) {
        showMessage(message, error.message, true);
    }
});


// ---------------- SKILL ASSESSMENT ----------------

$("#assessmentForm").addEventListener("submit", async event => {
    event.preventDefault();

    const message = $("#assessmentMessage");

    if (!currentProfile) {
        showMessage(
            message,
            "Please create your profile first.",
            true
        );
        return;
    }

    const skills = {
        html: Number($("#html").value),
        css: Number($("#css").value),
        javascript: Number($("#javascript").value),
        python: Number($("#python").value),
        java: Number($("#java").value)
    };

    try {
        const result = await api("/api/assessment", {
            method: "POST",
            body: JSON.stringify({
                profile_id: currentProfile.profile_id,
                ...skills
            })
        });

        currentSkills = result.skills;
        currentCareers = result.careers;

        $("#skillsCount").textContent = "5/5";
        $("#averageScore").textContent = result.average + "%";

        renderCareers(result.careers);

        showMessage(
            message,
            "Assessment saved! Your career matches are ready."
        );

        await refreshDashboard();

        $("#careers").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        showMessage(message, error.message, true);
    }
});


// ---------------- CAREER MATCHES ----------------

function renderCareers(careers) {
    const container = $("#careerResults");

    container.innerHTML = "";

    careers.forEach((career, index) => {
        const card = document.createElement("article");
        card.className = "career-card";

        const title = document.createElement("h3");
        title.textContent = career.name;

        const description = document.createElement("p");
        description.textContent = index === 0
            ? "Your highest-scoring match based on the current assessment."
            : "An alternative career path to explore.";

        const scoreLine = document.createElement("div");
        scoreLine.className = "score-line";

        const scoreLabel = document.createElement("span");
        scoreLabel.textContent = "Skill match";

        const scoreValue = document.createElement("strong");
        scoreValue.textContent = career.score + "%";

        scoreLine.append(scoreLabel, scoreValue);

        const track = document.createElement("div");
        track.className = "progress-track";

        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = career.score + "%";

        track.appendChild(fill);

        const button = document.createElement("button");
        button.className = "primary-button";
        button.textContent = "View Roadmap →";

        button.addEventListener("click", () => {
            loadRoadmap(career.name);
        });

        card.append(
            title,
            description,
            scoreLine,
            track,
            button
        );

        container.appendChild(card);
    });
}


// ---------------- LEARNING ROADMAP ----------------

async function loadRoadmap(careerName) {
    const container = $("#roadmapContent");

    try {
        const result = await api(
            "/api/roadmap/" + encodeURIComponent(careerName)
        );

        container.innerHTML = "";

        result.steps.forEach((step, index) => {
            const row = document.createElement("div");
            row.className = "roadmap-step";

            const number = document.createElement("div");
            number.className = "roadmap-number";
            number.textContent = String(index + 1).padStart(2, "0");

            const text = document.createElement("p");
            text.textContent = step;

            row.append(number, text);
            container.appendChild(row);
        });

        $("#roadmap").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        container.textContent = error.message;
    }
}
// ---------------- SKILL GAP ANALYSIS ----------------
async function loadSkillGap(careerName) {
    const container = $("#skillGapContent");

    if (!currentProfile) {
        container.textContent = "Please create your profile first.";
        return;
    }

    try {
        const result = await api(
            "/api/skill-gap/" +
            currentProfile.profile_id + "/" +
            encodeURIComponent(careerName)
        );

        container.innerHTML = `
            <h3>${escapeHTML(result.career)}</h3>
            <h2>Career Match: ${result.match}%</h2>

            ${result.skills.map(skill => `
                <div class="gap-item">
                    <div class="score-line">
                        <strong>${escapeHTML(skill.skill)}</strong>
                        <span>${skill.current_score}% / 70%</span>
                    </div>

                    <div class="progress-track">
                        <div class="progress-fill"
                             style="width:${skill.current_score}%">
                        </div>
                    </div>

                    <p>
                        ${escapeHTML(skill.status)}
                        ${skill.gap > 0
                            ? "- Improve by " + skill.gap + " points"
                            : "- Target achieved"}
                    </p>
                </div>
            `).join("")}
        `;

        $("#skillGap").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        container.textContent = error.message;
    }
}


// ---------------- GOALS ----------------

$("#goalForm").addEventListener("submit", async event => {
    event.preventDefault();

    const message = $("#goalMessage");
    const title = $("#goalTitle").value.trim();

    if (!currentProfile) {
        showMessage(
            message,
            "Please create your profile first.",
            true
        );
        return;
    }

    try {
        const result = await api("/api/goals", {
            method: "POST",
            body: JSON.stringify({
                profile_id: currentProfile.profile_id,
                title
            })
        });

        currentGoals.push(result.goal);

        $("#goalTitle").value = "";

        renderGoals();
        showMessage(message, "Goal added successfully.");

    } catch (error) {
        showMessage(message, error.message, true);
    }
});


function renderGoals() {
    const container = $("#goalList");

    container.innerHTML = "";

    if (currentGoals.length === 0) {
        container.textContent = "No goals yet. Add your first learning goal.";
        container.className = "empty-state";
    } else {
        container.className = "goal-list";

        currentGoals.forEach(goal => {
            const row = document.createElement("div");

            row.className = "goal-item" +
                (goal.completed ? " done" : "");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(goal.completed);

            checkbox.addEventListener("change", async () => {
                checkbox.disabled = true;

                try {
                    await api("/api/goals/" + goal.id, {
                        method: "PATCH",
                        body: JSON.stringify({
                            completed: checkbox.checked
                        })
                    });

                    goal.completed = checkbox.checked ? 1 : 0;
                    renderGoals();

                } catch (error) {
                    checkbox.checked = !checkbox.checked;
                    showMessage(
                        $("#goalMessage"),
                        error.message,
                        true
                    );
                } finally {
                    checkbox.disabled = false;
                }
            });

            const title = document.createElement("span");
            title.textContent = goal.title;

            row.append(checkbox, title);
            container.appendChild(row);
        });
    }

    const completed = currentGoals.filter(
        goal => Boolean(goal.completed)
    ).length;

    $("#goalCount").textContent =
        completed + "/" + currentGoals.length;
}

// PROGRESS TRACKER
const total = currentGoals.length;
const pending = total - completed;

const percentage = total > 0
    ? Math.round((completed / total) * 100)
    : 0;

$("#totalGoals").textContent = total;
$("#completedGoals").textContent = completed;
$("#pendingGoals").textContent = pending;
$("#goalProgress").textContent = percentage + "%";

$("#goalProgressBar").style.width = percentage + "%";

// ---------------- DASHBOARD REFRESH ----------------

async function refreshDashboard() {
    if (!currentProfile) return;

    const result = await api(
        "/api/dashboard/" + currentProfile.profile_id
    );

    currentGoals = result.goals;
    currentSkills = result.skills;

    if (Object.keys(result.skills).length > 0) {
        $("#skillsCount").textContent = "5/5";
        $("#averageScore").textContent = result.average + "%";

        Object.entries(result.skills).forEach(([skill, score]) => {
            const slider = $("#" + skill);
            const output = $("#" + skill + "Value");

            slider.value = score;
            output.textContent = score + "%";
        });
    }

    renderGoals();
}


// ---------------- THEME ----------------

$("#themeButton").addEventListener("click", () => {
    document.body.classList.toggle("light");

    localStorage.setItem(
        "devpath-theme",
        document.body.classList.contains("light")
            ? "light"
            : "dark"
    );
});

if (localStorage.getItem("devpath-theme") === "light") {
    document.body.classList.add("light");
}
// CAREER REPORT
$("#downloadReport").addEventListener("click", () => {

    if (
        !currentProfile ||
        !currentSkills ||
        Object.keys(currentSkills).length === 0
    ) {
        alert("Please complete your profile and skill assessment first.");
        return;
    }

    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
        alert("Please allow pop-ups to download your report.");
        return;
    }

    const skillsHTML = Object.entries(currentSkills)
        .map(([skill, score]) => `
            <tr>
                <td>${escapeHTML(skill.toUpperCase())}</td>
                <td>${score}%</td>
            </tr>
        `).join("");

    const careersHTML = currentCareers.map(career => `
        <tr>
            <td>${escapeHTML(career.name)}</td>
            <td>${career.score}%</td>
        </tr>
    `).join("");

    reportWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>DevPath AI Career Report</title>
            <style>
                body {
                    font-family: Arial;
                    padding: 30px;
                    color: #222;
                }
                h1 { color: #2563eb; }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th, td {
                    border: 1px solid #ccc;
                    padding: 12px;
                    text-align: left;
                }
                th { background: #eaf0ff; }
            </style>
        </head>
        <body>
            <h1>DevPath AI</h1>
            <h2>Career Progress Report</h2>
            <p><b>Student:</b>
                ${escapeHTML(currentProfile.name || "Student")}
            </p>

            <h3>Skill Assessment</h3>
            <table>
                <tr><th>Skill</th><th>Score</th></tr>
                ${skillsHTML}
            </table>

            <h3>Career Recommendations</h3>
            <table>
                <tr><th>Career</th><th>Match</th></tr>
                ${careersHTML}
            </table>

            <p>Generated by DevPath AI</p>
            <script>
                window.onload = function() {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `);

    reportWindow.document.close();
});
