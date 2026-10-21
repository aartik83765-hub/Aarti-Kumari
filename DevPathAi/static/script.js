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