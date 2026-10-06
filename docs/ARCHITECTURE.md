# AI 4D — Architecture

## System view

```text
┌──────────────────────┐
│ Spatial / Time Data  │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Representation       │
│ state + history      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Temporal Intelligence│
│ prediction / pattern │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Simulation / Action  │
└──────────────────────┘
```

## Current implementation

- **Frontend:** static HTML/CSS/JavaScript
- **Visualization:** Canvas-based 4D projection
- **Temporal layer:** dependency-free Python baseline
- **Deployment:** GitHub Pages workflow

## Future implementation

The architecture is intentionally modular so the baseline can evolve toward:

- a real dataset;
- a Python ML service;
- REST or streaming APIs;
- model evaluation;
- GPU-accelerated visualization;
- WebGL/WebGPU simulation;
- multimodal inputs.

The project distinguishes between a **visual prototype** and a **validated machine-learning system**. Future model claims should be supported by measurable experiments and evaluation data.
