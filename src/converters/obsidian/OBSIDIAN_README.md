# Vault Converter

The vault converter works like this:

* go through the vault folder recursively
* create a node for each folder and append it partially to the target file (we leave the children array open)
* convert each file to a node and append it to the target file (see Markdown Nodes explanation)
* close each folder-node as soon as its done

Vaults can be quite big, so this append-approach is much more performant. 
We use the VaultContext to store all information that is needed across the whole vault, so that we don't need to go back to the created Tana nodes.

# Concepts

## Folder Nodes

In Obsidian vaults the folder structure is important. For example a PARA approach would have at least four top-level folder and these are critical for orientation (at least until a more Tana-native orientation is established). Therefore we nest all the created nodes under "Folder Nodes" which are created for each folder in the vault.

## Markdown Nodes

Each markdown file is first parsed into a sequential list of Markdown Nodes by breaking up the file according to hierarchy-indicators like headings. These Markdown Nodes are very similar to Tana IF Nodes but don't yet form a graph and contain additional information about the hierarchy level they come from.

This "second" intermediate format is much easier to debug than the finalized graph structure. It also is necessary outside of Developer Experience considerations: the markdown file needs to become a nested list and for this we need the hierarchy information. Just parsing it as a flat structure is not going to cut it because it loses valuable semantic information.

The Markdown Nodes are lightly pre-processed to contain only relevant information.

## Conversion to the Tana IF

Markdown Nodes are converted to Tana IF Nodes, which are then used in the resulting JSON file. We use the hierarchy information in the Markdown Nodes to create the appropriate nesting. 

Each Obsidian Link is replaced with a new UID, also each file and folder gets a UID. Via the VaultContext we make sure that the correct UID is used when we replace the Obsidian Links.

### Missing nodes

Missing Links (no file exists for these) are collected and saved in a separate node under "Missing nodes for $YOUR_VAULT_NAME". We could of course not save these links but then we would need to take care how to not lose the Obsidian Link-name (because it was converted to a UID). 

## VaultContext

We need some context information like the summary data that needs to be used across the whole converted vault. The place for this is the VaultContext. 

