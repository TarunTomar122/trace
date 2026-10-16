# Morning X post (founder's laptop)

Each morning, the first time the laptop wakes after 05:00, `trace_xpost.py`:

1. asks the VPS for today's post (`ssh vps … build_post_kit --json`): "Biggest
   updates in tech in the last 24 hours:", 3-6 short, plain lines and "Did I
   miss anything??", the reply with the Trace link, the best image of the
   first story and this week's YouTube videos of it;
2. downloads about 30 seconds of the first video that works. YouTube blocks the
   VPS but not a home connection, which is why this half runs here;
3. writes `~/x-posts/{date}/index.html` with the clip and the image inside it:
   Copy post, Download video (then drag it from the browser's downloads into
   the post: browsers can't copy a video), Copy image, Download image and Copy
   reply. `post.txt`, `x-post.jpg` and `x-clip.mp4` sit beside it, and
   `~/x-posts/latest` points at the day;
4. shows a notification. Clicking it opens the page.

Nothing is posted anywhere: you post it. The VPS also runs at 07:30 UK time
(`trace-postkit.timer`); whichever run comes first writes the day's post and the
other reuses it, so the model is asked once a day. The job only runs while the
laptop's date matches the feed's (India's) date, roughly 05:00 to 19:30 UK
time, so an evening wake never makes tomorrow's post early.

## Install or update

```sh
sh backend/laptop/install.sh
```

The script:

- makes `~/.trace-xpost/venv` with yt-dlp (the job upgrades it once a week);
- copies the script there, because macOS keeps background jobs out of
  `~/Documents`;
- installs `ffmpeg`, `terminal-notifier` and `deno` (yt-dlp needs a JavaScript
  runtime for YouTube) with Homebrew if they're missing;
- loads the launchd agent `online.yourtrace.xpost`.

It needs `ssh vps` to work without a password prompt. macOS shows "Background
Items Added" for the job, and the first notification may ask you to allow
notifications for terminal-notifier.

Run it again after changing `trace_xpost.py`.

## By hand

```sh
~/.trace-xpost/venv/bin/python ~/.trace-xpost/trace_xpost.py --force   # again today
~/.trace-xpost/venv/bin/python ~/.trace-xpost/trace_xpost.py --fresh   # with a newly written post
tail -f ~/Library/Logs/trace-xpost.log
```

To remove it:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/online.yourtrace.xpost.plist
rm ~/Library/LaunchAgents/online.yourtrace.xpost.plist   # or it comes back at the next login
rm -rf ~/.trace-xpost                                     # the venv and the script's state
```
