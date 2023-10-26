# Heatmap for VS Code

![Heatmap](images/icon.png)

Heatmap lets you visualise the relative age of lines in source under Git version
control.  By toggling the heatmap on, the background colour of every line in the
file is altered to reflect the relative age; the brightest lines are the most
recent.

Requires `git` in your `$PATH`.

## Example

Here's a screenshot showing the relative age of some lines in the FreeBSD kernel
source:

![Screenshot](images/screenshot.png)

## Commands

Heatmap adds the following commands to the command palette:

- Heatmap: On
- Heatmap: Off

## Configuration

|Property|Description|Type|Default value|
|---|---|---|---|
|`heatmap.heatLevels`|The number of different heat levels to visualise.|Integer|10|
|`heatmap.heatColour`|The R,G,B of the brightest heat level.|String|`200,0,0`|

## Thanks

- Thanks to DALL-E 3 for generating the icon/logo.