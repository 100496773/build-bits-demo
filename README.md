# Build-Bits Interactive Demo 🤖🧩

An interactive, high-fidelity web prototype for the **Build-Bits** social educational robot. This application serves as a presentation-ready interactive demo specifically designed for children with ADHD, helping them improve attention, working memory, executive functions, and creativity through guided, low-stimulation block-building activities.

## 🌟 Key Features

- **Four Unique Play Modes:**
  - **Guided Mode:** Step-by-step guidance with glowing visual support.
  - **Creative Mode:** Open-ended matching gameplay to replicate a visual goal.
  - **Memory Mode:** Timed observation phases that hide the goal, requiring the child to reconstruct from memory.
  - **Challenge Mode:** Time pressure and dynamic scoring tests focus and speed.
- **Flow Zone System (Adaptive Difficulty):** Actively monitors inactivity and mistake counts to silently adjust difficulty and trigger positive, encouraging hints when frustration is detected.
- **Micro-Animations & Physics:** Custom JS-driven slick drag-and-drop mechanics mimicking real physical interactions with "snap" and "shake" feedback animations.
- **ADHD-Friendly Design:** Zero visual clutter, soft pastel interfaces (`Slate 50`, `Soft Blues`), calm Google typography, and rounded UI forms.
- **Zero-Dependency Architecture:** Written entirely in native Vanilla ES6 JavaScript for ultimate speed and local execution ease!

## 🛠️ Technology Stack

- **Core:** HTML5, CSS3 Variables, Vanilla ES6 JavaScript
- **Icons:** [Lucide Icons](https://lucide.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/) (Used exclusively for production bundling optimizations)

## 💻 Local Execution & Setup

Because this project utilizes a zero-dependency Vanilla Javascript architecture, there are two distinct ways you can run it locally:

### Option 1: The "No Install Required" Method 
The easiest way to preview the application if you don't use Node.js:
1. Navigate to the project root folder.
2. Double-click the `index.html` file to open it in Chrome, Edge, or Firefox. 
3. Play immediately!

### Option 2: The Modern Dev Environment
To run the project with hot-module reloading and prepare it for production modifying using Vite:
1. Ensure [Node.js](https://nodejs.org/) is installed.
2. Open a terminal in the project directory.
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Start the local Vite server:
   ```bash
   npm run dev
   ```

## 🚀 Deployment Notes (Vercel / GitHub)

This application is structurally configured for immediate automated deployment on [Vercel](https://vercel.com).

1. Initialize a Git repository using `git init`, commit the exact structure shown below, and push your repository to **GitHub**.
2. Log into the Vercel dashboard and click **Add New Project**.
3. Import your Build-Bits GitHub repository.
4. **Important**: Vercel will automatically detect `package.json` and select the **Vite** Framework Preset.
5. Click **Deploy**. Vercel will execute the `npm run build` script and launch your optimized static site globally!

---
*Built as a presentation-grade concept for immersive, adaptive tech-education.*
