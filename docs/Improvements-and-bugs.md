Improvements

1. The Quran is in Arabic, so it reads from Right to left, this mean: Swipe Left = going back in pages\
   Swipe Right = going front in pages
2. You still didn't fix the height of the play banner when users are viewing it from the Home page, that's because the nav bar overlaps it.
3. Reading Mushaf you did it poorly. I want it to view as much text as possible in a single view, not one ayah at a time. Also the swiping direction on it needs to be fixed. The way we had it before was much closer, just instead of having to scroll to the bottom of the page you can swipe to continue reading it. It's not that complicated. You mis-implemented this feature. You may need to revert to how it was before and use that as a starting point again.

1. When audio is playing I'd like you to highlight the Ayah being recited even in the "Read" page. We need to better integrate the "Read" and "Listen capabilities, you're thinking of them too much as two separate use cases, we should actually merge them into a single page called "Quran". Where you select the Surah/Ayah, and you can choose to have it play or read it.
2. The Navigation bar cuts into the Play banner. You fixed it when I'm in "Read" mode but not when I'm in the home, read, or listen pages. The entire Play banner needs to shift up above the Nav bar
2. When playing from any Ayah it needs to default to continue until the end of the Surah.
2. When the audio ends for a Surah it continues to the next Surah but the "Open Reader" view just stops at the current Surah
2. Let's add to the "Play Until" the option to go until End of Quran
2. The Previous / Next buttons next to "Play" are grayed out. I want to be able to use them.
2. When I click into "Open Reader" from within the audio player it shows me a temporary module, that's fine, but I want to click a button where the reader view becomes the main view with audio playing in the background. Think about the Kindle user interface for example. Audio and reading go hand in hand, they are not two separate feature

