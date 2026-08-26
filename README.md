# Khoros Tools - Perform useful functions on HP community support site.

## Useful only for volunteers at the HP support community.  This is an independent community tool and is not an official HP product.


1. Khoros spoilers are fixed.  Useful only after pasting from a macro into a Khoros post.  Position the cursor anywhere in the post's edit box and select Fix Khoros spoilers to restore the spoiler.
2. Khoros unfriendly HTML can be cleaned, citations removed, and put into a spoiler.
3. You can start the HP SupportGPT and ask it a question.  Unfriendly Khoros HTML is removed and the answer can be returned using a **Copy Answer** button.  You **must run the start** before every question and any previous session will be deleted.  You should select **Stop SupportGPT** when no longer using SupportGPT to answer questions in any Khorus enabled forum.
4. You can search your own posts for a phrase using "Find This Phrase" or "Find all my answers"
5. Copy and paste (for example) a Google response into the edit box.  Click "Clean Pasted HTML" Demo video [is here](https://stateson.net/images/DemoRemoveCitations.mp4)
6. Instead of Copy and Paste, if the Google COPY icon is selected then all approved footnotes are put into a spoiler.
7. A demo video showing the spoiler feature is [here](https://stateson.net/images/DemoPutCleanedIntoSpoiler.mp4)
8. Demo video of the HP SupportGPT [is here](https://stateson.net/images/DemoHPsupportGPT.mp4).
9. **WARNING** please review **ISSUES** before installing the extension.  Feel free to create an issue is there is a problem.

## To install this extension

1. Clone this repository or download the zip and unpack into "Khoros_Tools"
2. Load the HP_Search folder in Chrome as an [unpacked extension](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked).
3. Enable the extension and be sure to disable developer mode***.
4. Select the text you want to search and right-click within the selection to view to get the desired lookup.
5. Tested on Chrome and Edge in Windows 11 and looks like this
6. ![alt text](https://stateson.net/images/KhorosTools.png)

Explanation of the two search functions and the difference from the existing Khoros search
1.  The built in community search
	1. You enter "call of duty" including the quotation marks
	2. You select your name so that the search is limited to your posts
	3. Results:  You may have 8 threads. 3 you might have originated and 5 you responded to.
	4. Analysis: Only phrases found in the body of the text are being reported.
	
2.	The new Khoros Tools function Find this phrase
	1. You highlight a phrase such as **Call Of Duty** and select the Find This Phrase
	2. You are logged in as your name is shown top right of display
	3. Results: You may have 14 threads. 3 you originated.  11 you responded to.  The extra 6 are posts where you did not quote that phrase but the author did.
	4. Analysis: Phrases in the title are reported in addition to the subject.
	
3.	The new Khoros Tools function Find all my answers
	1. Same as find my phrase but will find your response to a post **where the phrase is in the body of the original post but missing from any title**.
	THIS IS NOT COMPLETED.  Currently the "Find this phrase" part is not combined yet