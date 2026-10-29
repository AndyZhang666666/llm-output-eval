# Eval Lab

[中文](README.md) · [Project index](https://github.com/AndyZhang666666/AndyZhang666666/blob/main/PROJECTS.en.md) · [Live demo](https://andyzhang666666.github.io/llm-output-eval/)

Can a reviewer inspect the evidence behind a low score and disagree with the judge?

![Actual Eval Lab interface](https://andyzhang666666.github.io/assets/work/showcase/eval-crop.jpg)

## Product decisions

- Separate dimensions and require a source passage for each judgement.
- Keep citation location distinct from human review; never overwrite the saved score.
- Retain the run, sample and prompt context in exportable records.

## Walkthrough

1. Open a historical sample and select a low-scoring dimension.
2. Locate its quotation in the source, then record support, doubt or a need for context.
3. Compare the truncated and complete versions of the same story and export the review.

## Run mode and limits

The default replays 18 saved outputs across six samples without a key. A live endpoint is optional. Historical calibration results were not rerun for the current interface.

Saved model outputs and calibration results belong to their original samples and prompts. This documentation update does not rerun model evaluations or establish production accuracy. Labels and disagreements remain inspectable.

## Develop locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/llm-output-eval/`. The repository base path is part of the URL.

## Lightweight checks

```sh
npm run test:core
npm run check:replay
npm run build
```

These commands are provided for reproduction; this documentation update did not run a new model benchmark.

## Documentation

- [Product scope](docs/PRD.md)
- [Interface design](docs/DESIGN.md)
- [Historical judge calibration](validation/judge-validation.md)
- [Validation records](docs/VALIDATION.md)
- [Implementation details and original records, Chinese](README.md)

Use the repository’s existing licence and notices. This update does not change usage rights.
