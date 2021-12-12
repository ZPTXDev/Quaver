# Contributing to Quaver
Hi! I'm glad to see that you're interested in helping to make Quaver better for everyone.

Before we proceed, there are a few things to take note of.

It will make the development process a lot simpler and easier to understand.

## Prerequisites
In order to ensure that Quaver runs during development, the prerequisites in [README.md](README.md#prerequisites) must be satisfied first.

I highly recommend using [Visual Studio Code](https://code.visualstudio.com/) if you do not have an IDE of choice.

Here are the additional prerequisites for development:
- [Git](https://git-scm.com/) ([setup steps here](https://docs.github.com/en/get-started/quickstart/set-up-git))
- [GitHub](https://github.com) account

## Setting up the environment
Choose a safe place on your drive.

You don't need to make a folder/directory as it will be generated when you run the commands in the next step.

Run `git clone https://github.com/ZapSquared/Quaver.git` to clone the repository to the 'Quaver' folder/directory.

Then, navigate to the newly created folder/directory through your terminal and run `npm install` to install all dependencies.

You may follow [this](README.md#starting-quaver-for-the-first-time) to verify Quaver is installed correctly.

## ESLint
This project uses ESLint.

The configuration file is provided at the base of the repository [here](.eslintrc.json).

To ensure ESLint is enabled and linting, you must have it installed on your IDE as well.

### Visual Studio Code
1. From the IDE, open Extensions on the left panel
2. Search for ESLint in the Marketplace
3. Click Install

### Atom
1. Open Settings / Preferences
2. Navigate to the Install tab
3. Search for `linter-eslint`
3. Click Install

### IntelliJ IDEA Ultimate / Webstorm
ESLint is already integrated into your IDE.
- IntelliJ IDEA Ultimate: [Guide](https://www.jetbrains.com/help/idea/eslint.html#ws_js_eslint_activate)
- Webstorm: [Guide](https://www.jetbrains.com/help/webstorm/eslint.html#ws_js_eslint_activate)

### Other IDEs
I can't guarantee that the steps are the same, but it should be similar.

Try searching for ESLint installation steps on Google for your IDE of choice.

## Documentation and References
discord.js
- https://discord.js.org/#/docs/main/stable/general/welcome

## Commit messages
This project uses [Semantic Commit Messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716).

Pull requests are checked for Semantic Commits automatically, meaning checks will fail if you do not adhere to them.

## Pull requests
Once you are ready to commit your changes, create a pull request, merging to the `next` branch.

You may request a review when you are ready. As long as the checks are passing, and there isn't any reason to deny your pull request, it'll be merged.