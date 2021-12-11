# Contributing to Quaver
Hi! I'm glad to see that you're interested in helping to make Quaver better for everyone.

Before we continue, there are a few things to take note of. This should help make the development process a lot simpler and easier to understand.

## Prerequisites
In order to ensure that Quaver runs during development, the prerequisites in [README.md](README.md#prerequisites) must be satisfied first.

I highly recommend you use [Visual Studio Code](https://code.visualstudio.com/) if you do not have an IDE of choice.

Here are the additional prerequisites for development:
- [Git](https://git-scm.com/) ([setup steps here](https://docs.github.com/en/get-started/quickstart/set-up-git))
- [GitHub](https://github.com) account

## Setting up the environment
Choose a safe place on your drive. You don't need to make a folder/directory, it'll be made when you run the commands in the next step.

Run `git clone https://github.com/ZapSquared/Quaver.git` to clone the repository to the 'Quaver' folder/directory.

Then, run `npm install` to install all dependencies.

You may follow [this](README.md#starting-quaver-for-the-first-time) to start Quaver for the first time, and then proceed to follow the rest of the guide.

## ESLint
This project uses ESLint. The configuration file is provided at the base of the repository [here](.eslintrc.json), and it requires that you install ESLint on your IDE as well (for Visual Studio Code, go to Extensions, and simply install ESLint).

## Documentation and References
discord.js
- https://discord.js.org/#/docs/main/stable/general/welcome

## Commit messages
This project uses [Semantic Commit Messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716).

## Pull requests
Once you are ready to commit your changes, create a pull request, merging to the `next` branch.

You may request a review when you are ready. As long as the checks are passing, and there isn't any reason to deny your pull request, it'll be merged.