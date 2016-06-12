# ncline-screenshots

This is an add-on command module for the [ncline](https://github.com/bcswartz/ncline) platform that manages the naming and organizing of screenshot files as they are created on your computer.

## Background And Overview

ncline ("**N**ode **c**ommand **line**") is a platform for writing Node-powered JavaScript functions ("commands") that can be executed from a command-line interface.
Even though ncline is an executable Node program, it's described as a platform because it allows developers to add their own commands for execution in ncline
by following the conventions for creating a command module folder.  The contents of this repo represent such a command module.

The purpose of this module is to provide ncline users with a tool for manipulating screenshot files as they are created.
Once the directory where the screenshot files are created is defined in the module, the module will set a watcher on
that directory as soon as ncline is launched, and when any file is added to that directory the watcher will process that file
based on a series of processing rules for renaming and moving the file.  The modules comes with two existing rules:
* It will rename the file based on a customizable prefix and the time of day the file was created.
* It will move the file into the subdirectory of the screenshot filepath that matches the date the file was created (creating the subdirectory if it doesn't exist already).

So for example, if the customizable prefix was "projectAlpha" and the screenshot was taken on June 14, 2016 at exactly 3:30pm, the
screenshot file would end up with the name "projectAlpha-15-30-00" and end up in the folder "2016-06-14" within the main screenshots folder.

Developers can modify those rules or add new ones.

The module provides several commands for modifying the behavior of the module and the file watcher, including commands
for changing the prefix, changing the screenshot filepath, toggling the active state of the watcher and the processing rules.
Consult the ncline documentation for how to get a list of all commands and pull up details about a specific command.

## Installation and Configuration

Installing and using this module involves the following steps.

1. Download and install [ncline](https://github.com/bcswartz/ncline).
2. Download the zip file for this repo.
3. In the ncline installation on your computer, create a "screenshots" directory under the cmdModules/private directory.
4. Unzip the files from this repo into that directory.
5. Open a terminal/command window and navigate to the cmdModules/private/screenshots directory.  Within that directory, execute "npm install".  That will install the [chokidar](https://github.com/paulmillr/chokidar) npm module used to create the file watcher.
6. Once npm install is finished, in the same terminal/command window navigate up to the root ncline directory.
7. Start ncline with "node ncline.js".
8. At the ncline command prompt, type "setSSPath {dir}", where "{dir}" is the directory where screenshot files are created.
9. Restart ncline.

With those steps completed, anytime you run ncline, any files within that screenshot directory (even files added when ncline was not running) will be processed by the screenshots module.

### Miscellaneous

* It is highly recommended that you have a screenshot directory whose sole purpose is to receive the created screenshots, since any file that makes its
way into that folder will be processed by this module.  In OS X, the default screenshot keyboard shortcut provided by the OS puts the screenshot files on the desktop, which is less than ideal.
Mac users should follow the instructions on Apple forum post [DOC-9081](https://discussions.apple.com/docs/DOC-9081) for changing where OS X dumps the screenshot files.
* If you get an "EBUSY: resource busy or locked" error whenever the module attempts to rename the screenshot file, that's likely an indicator that the OS process or
program that creates the screenshot file has not released control of the file by the time the module attempts to process it.  To solve that scenario, go into the
commands.js file, find the code where the watcher object is returned by the chokidar watch() method, and try increasing the awaitWriteFinish intervals.
