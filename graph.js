import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";
import random from "random";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import fs from "fs";

const path = "./data.json";
const git = simpleGit();

const writeCommit = async (date, message) => {
  const data = { date };
  await jsonfile.writeFile(path, data);
  await git.add(path);
  await git.commit(message, path, { "--date": date });
};

const generateRealisticCommits = (startDate, endDate, totalCommits) => {
  const start = moment(startDate, "YYYY-MM-DD");
  const end = moment(endDate, "YYYY-MM-DD");
  const totalDays = end.diff(start, "days") + 1;

  let commits = [];
  let commitsLeft = totalCommits;

  // Define academic calendar periods
  const academicPeriods = {
    // 2024 periods
    "2024-10-26": { type: "mid_semester", intensity: 0.7 },
    "2024-11-15": { type: "project_deadline", intensity: 1.2 },
    "2024-11-25": { type: "pre_exam", intensity: 0.4 },
    "2024-12-10": { type: "exam_period", intensity: 0.2 },
    "2024-12-20": { type: "break", intensity: 0.1 },
    
    // 2025 periods
    "2025-01-15": { type: "semester_start", intensity: 0.8 },
    "2025-02-15": { type: "mid_semester", intensity: 0.7 },
    "2025-03-10": { type: "spring_break", intensity: 0.3 },
    "2025-04-15": { type: "project_deadline", intensity: 1.3 },
    "2025-05-01": { type: "pre_exam", intensity: 0.5 },
    "2025-05-15": { type: "exam_period", intensity: 0.2 },
    "2025-06-01": { type: "summer_break", intensity: 0.4 },
    "2025-07-15": { type: "summer_projects", intensity: 0.9 },
    "2025-08-15": { type: "pre_semester", intensity: 0.6 }
  };

  // Create project clusters (3-4 major projects per year)
  const projectClusters = [];
  const numProjects = Math.floor(totalDays / 90) + 1; // ~1 project per 3 months
  
  for (let i = 0; i < numProjects; i++) {
    const projectStart = moment(start).add(i * 90 + random.int(0, 30), "days");
    const projectDuration = random.int(14, 28); // 2-4 weeks
    const projectEnd = moment.min(moment(end), moment(projectStart).add(projectDuration, "days"));
    
    projectClusters.push({
      start: projectStart,
      end: projectEnd,
      intensity: random.float(1.2, 2.0), // High activity during projects
      commits: random.int(15, 40) // Commits for this project
    });
  }

  // Generate commits with realistic patterns
  const weeks = Math.floor(totalDays / 7) + 1;

  for (let w = 0; w < weeks; w++) {
    const weekStart = moment(start).add(w * 7, "days");
    const weekEnd = moment.min(moment(end), moment(weekStart).add(6, "days"));

    // Check if we're in a project cluster
    const currentProject = projectClusters.find(p => 
      weekStart.isBetween(p.start, p.end, null, '[]')
    );

    // Get academic period intensity
    let academicIntensity = 1.0;
    for (const [date, period] of Object.entries(academicPeriods)) {
      if (weekStart.isAfter(moment(date)) && weekStart.isBefore(moment(date).add(14, "days"))) {
        academicIntensity = period.intensity;
        break;
      }
    }

    // Determine week intensity
    let weekIntensity = academicIntensity;
    if (currentProject) {
      weekIntensity *= currentProject.intensity;
    }

    // Add some natural variation
    weekIntensity *= random.float(0.7, 1.3);

    // Calculate active days for this week
    let activeDays;
    if (weekIntensity < 0.5) {
      activeDays = random.int(1, 2); // Low activity weeks
    } else if (weekIntensity < 1.0) {
      activeDays = random.int(2, 4); // Normal weeks
    } else {
      activeDays = random.int(4, 6); // High activity weeks
    }

    // Include some weekend activity (5-10% of weeks)
    const includeWeekend = Math.random() < 0.08;
    
    let availableDays = [];
    for (let d = 0; d <= weekEnd.diff(weekStart, "days"); d++) {
      const day = moment(weekStart).add(d, "days");
      if (day.day() >= 1 && day.day() <= 5) { // Weekdays
        availableDays.push(day);
      } else if (includeWeekend && (day.day() === 0 || day.day() === 6)) { // Weekend
        availableDays.push(day);
      }
    }

    activeDays = Math.min(activeDays, availableDays.length);
    let chosenDays = random.sample(availableDays, activeDays);

    for (let day of chosenDays) {
      if (commitsLeft <= 0) break;

      // Realistic commit patterns based on intensity
      let commitCount;
      const rand = Math.random();
      
      if (weekIntensity < 0.5) {
        // Low intensity: mostly 1 commit, occasional 2
        commitCount = rand < 0.8 ? 1 : 2;
      } else if (weekIntensity < 1.0) {
        // Normal intensity: varied patterns
        if (rand < 0.5) commitCount = 1;
        else if (rand < 0.8) commitCount = random.int(2, 3);
        else commitCount = random.int(4, 6);
      } else {
        // High intensity: more commits, clustering
        if (rand < 0.3) commitCount = 1;
        else if (rand < 0.6) commitCount = random.int(2, 4);
        else if (rand < 0.8) commitCount = random.int(5, 8);
        else commitCount = random.int(9, 15); // Heavy coding sessions
      }

      const n = Math.min(commitsLeft, commitCount);
      for (let i = 0; i < n; i++) {
        commits.push(day.clone());
      }
      commitsLeft -= n;
    }
  }

  // Distribute remaining commits with natural clustering
  while (commitsLeft > 0) {
    // Find a random day that's not too crowded
    const offset = random.int(0, totalDays - 1);
    const day = moment(start).add(offset, "days");
    
    // Prefer weekdays but allow some weekend activity
    const isWeekend = day.day() === 0 || day.day() === 6;
    if (!isWeekend || Math.random() < 0.1) {
      commits.push(day.clone());
      commitsLeft--;
    }
  }

  return commits;
};

// --- GitHub-style Preview ---
const previewGraph = async (allCommits) => {
  const commitCount = {};
  for (let c of allCommits) {
    const day = c.format("YYYY-MM-DD");
    commitCount[day] = (commitCount[day] || 0) + 1;
  }

  const start = moment.min(allCommits).startOf("week");
  const end = moment.max(allCommits).endOf("week");
  const days = end.diff(start, "days") + 1;

  const dates = [];
  const values = [];
  for (let i = 0; i < days; i++) {
    const d = moment(start).add(i, "days");
    dates.push(d);
    values.push(commitCount[d.format("YYYY-MM-DD")] || 0);
  }

  const weeks = Math.floor(days / 7) + 1;
  const grid = Array.from({ length: weeks }, () => Array(7).fill(0));
  dates.forEach((d, i) => {
    const week = Math.floor(i / 7);
    const day = d.day();
    grid[week][day] = values[i];
  });

  // Create GitHub-style grid using Canvas API directly
  const width = 1400;
  const height = 250;
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Grid settings
  const cellSize = 12;
  const cellSpacing = 2;
  const totalCellSize = cellSize + cellSpacing;
  const startX = 50;
  const startY = 30;

  // Draw grid
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const x = startX + week * totalCellSize;
      const y = startY + day * totalCellSize;
      const value = grid[week][day];

      // GitHub color scheme
      let color = '#ebedf0'; // No commits
      if (value > 0) {
        if (value < 2) color = '#c6e48b';
        else if (value < 4) color = '#7bc96f';
        else if (value < 6) color = '#239a3b';
        else color = '#196127';
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }

  // Add month labels
  ctx.fillStyle = '#24292f';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  
  for (let week = 0; week < weeks; week += 4) {
    const date = moment(start).add(week * 7, "days");
    const month = date.format("MMM");
    const x = startX + week * totalCellSize;
    ctx.fillText(month, x, 20);
  }

  // Add day labels
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let day = 0; day < 7; day++) {
    const y = startY + day * totalCellSize + cellSize / 2 + 4;
    ctx.fillText(dayLabels[day], 10, y);
  }

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync("preview.png", buffer);
  console.log("✅ Preview saved as preview.png (GitHub-style)");
};

// --- MAIN RUN ---
const run = async () => {
  // Generate commits for 2024 (Oct 26 - Dec 31): 152 contributions
  const commits2024 = generateRealisticCommits("2024-10-26", "2024-12-31", 152);
  
  // Generate commits for 2025 (Jan 1 - Sep 15): 301 contributions  
  const commits2025 = generateRealisticCommits("2025-01-01", "2025-09-15", 301);

  const allCommits = [...commits2024, ...commits2025];

  console.log(`📊 Generated ${commits2024.length} commits for 2024 (Oct 26 - Dec 31)`);
  console.log(`📊 Generated ${commits2025.length} commits for 2025 (Jan 1 - Sep 15)`);
  console.log(`📊 Total: ${allCommits.length} commits`);

  // Save preview
  await previewGraph(allCommits);

  // Uncomment below to actually commit & push
  /*
  const realisticMessages = [
    // Academic project messages
    "implement user authentication system",
    "add database schema for student records",
    "fix login validation bug",
    "update API endpoints for course management",
    "refactor student dashboard component",
    "add error handling for file uploads",
    "implement real-time notifications",
    "optimize database queries",
    "add unit tests for user service",
    "fix responsive design issues",
    "update documentation",
    "implement search functionality",
    "add data validation",
    "fix memory leak in image processing",
    "optimize performance for large datasets",
    "add logging for debugging",
    "implement caching mechanism",
    "fix cross-browser compatibility",
    "add input sanitization",
    "update dependencies",
    
    // Personal project messages
    "initial commit for portfolio website",
    "add dark mode toggle",
    "implement contact form",
    "fix mobile navigation",
    "add project showcase section",
    "optimize images for web",
    "add smooth scrolling animations",
    "implement lazy loading",
    "fix accessibility issues",
    "add SEO meta tags",
    
    // Learning/experiment messages
    "experiment with new React hooks",
    "try different sorting algorithms",
    "learn about microservices architecture",
    "practice with TypeScript generics",
    "explore GraphQL queries",
    "test new CSS grid layouts",
    "experiment with WebGL",
    "practice with Docker containers",
    "learn about Redis caching",
    "explore machine learning basics",
    
    // Bug fixes and improvements
    "fix null pointer exception",
    "improve error messages",
    "add input validation",
    "fix timezone handling",
    "optimize image compression",
    "fix memory allocation issue",
    "improve code readability",
    "add configuration options",
    "fix race condition",
    "update error handling",
    
    // General development
    "clean up unused imports",
    "update README with setup instructions",
    "add environment variables",
    "fix linting errors",
    "update package versions",
    "add code comments",
    "refactor for better maintainability",
    "add integration tests",
    "improve user experience",
    "add loading states"
  ];

  for (let i = 0; i < allCommits.length; i++) {
    const date = allCommits[i].format();
    const msg = realisticMessages[random.int(0, realisticMessages.length - 1)];
    await writeCommit(date, msg);
  }
  await git.push();
  */
};

run();
