# AI 4D

> **Intelligence across space & time.**

An experimental web experience exploring the idea of intelligent systems that reason over **space, time and context**.

## Overview

AI 4D is a portfolio prototype built around a simple conceptual model: **3 spatial dimensions + time**. The project uses an interactive 4D hypercube (tesseract) projection to make that idea tangible in the browser.

This repository intentionally treats “AI 4D” as an **experimental concept**, not as the name of a single established scientific field.

### Why this project?

Most interfaces show data as snapshots. AI 4D asks a different question:

> What changes when the evolution of a system becomes part of the representation?

That connects naturally to areas such as temporal machine learning, spatial computing, simulation, multimodal systems and predictive modeling.

## Features

- Interactive 4D hypercube visualization
- 4D rotations across multiple planes
- Pointer drag + scroll interaction
- Responsive research-lab interface
- Conceptual AI architecture
- Research directions and roadmap
- Zero frontend dependencies for the core experience
- GitHub Pages-ready static site

## Architecture

    Spatial + Temporal Signals
              ↓
         Representation
              ↓
         State / Context
              ↓
        Temporal Model
              ↓
     Prediction / Simulation
              ↓
            Action

## Technology

| Layer | Technology |
|---|---|
| Interface | HTML5 |
| Styling | CSS3 |
| Interaction | Vanilla JavaScript |
| Visualization | HTML Canvas |
| 4D math | 4D rotations + perspective projection |
| Temporal experiments and API | Python, scikit-learn, FastAPI, SQLAlchemy, Alembic |
| Future acceleration | WebGL / WebGPU |

## API and temporal experiments

The repository includes an experimental FastAPI service, authentication, private projects/datasets/analysis sessions, Alembic migrations, and temporal prediction baselines. See [API setup and endpoints](api/README.md), [application notes](app/README.md) and [ML experiments](ml/README.md).

The public Pages link below serves the static visualization. It does not prove that a separate API/database deployment is active. The bundled series is synthetic.

Prediction compares lagged linear models with a persistence baseline. The returned MAE/RMSE are from the validation segment used to select the model and lag count, **not an independent final test set**. The chosen linear model is then refitted on all available observations for the next prediction. Uploads are limited to 8 MiB and 20,000 observations; configure request/rate limits at the hosting gateway as well.

## Project structure

    ai-4d/  (static visualization subset; API, app, ML, migrations and tests also exist)
    ├── index.html
    ├── styles.css
    ├── script.js
    ├── README.md
    ├── assets/
    │   └── favicon.svg
    └── .github/
        └── workflows/
            └── pages.yml

## Run locally

No build step is required.

    git clone https://github.com/marcellabongiolo/ai-4d.git
    cd ai-4d
    python -m http.server 8000

Then open http://localhost:8000.

## Roadmap

- [x] Interactive 4D visualization
- [x] Responsive research-lab interface
- [x] Conceptual system architecture
- [x] Temporal prediction baseline (statistical)
- [x] Learned temporal baseline with train/test evaluation
- [ ] Real time-series dataset
- [x] Experimental Python inference API (run locally; see api/README.md)
- [ ] WebGL/WebGPU acceleration
- [ ] 3D/4D simulation environment
- [ ] Multimodal AI experiment

## Portfolio context

AI 4D is designed as a technical portfolio project demonstrating frontend engineering, mathematical visualization, system thinking and an interest in AI-oriented research.

**Author:** Marcella Bongiolo  
**GitHub:** https://github.com/marcellabongiolo

## License

MIT License. See the repository license for details.
https://marcellabongiolo.github.io/ai-4d/?utm_source=chatgpt.com
