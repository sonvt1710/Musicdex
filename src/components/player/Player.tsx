import { useDisclosure, useToast } from "@chakra-ui/react";
import { useStoreState, useStoreActions } from "../../store";
import { Fragment, useEffect, useMemo, useState } from "react";
import PlayerStates from "youtube-player/dist/constants/PlayerStates";
import { formatSeconds } from "../../utils/SongHelper";
import { PlayerBar } from "./PlayerBar";
import { PlayerOverlay } from "./PlayerOverlay";
import { usePlayer, getID } from "./YoutubePlayer";

const retryCounts: Record<string, number> = {};
export function Player({ player }: { player: any }) {
  const {
    isOpen: isExpanded,
    onToggle: toggleExpanded,
    onClose: toggleClose,
  } = useDisclosure();
  const toast = useToast();

  // Current song
  const currentSong = useStoreState(
    (state) => state.playback.currentlyPlaying.song
  );
  const repeat = useStoreState(
    (state) => state.playback.currentlyPlaying.repeat
  );
  const next = useStoreActions((actions) => actions.playback.next);

  const totalDuration = useMemo(
    () => (currentSong ? currentSong.end - currentSong.start : 0),
    [currentSong]
  );

  const { currentVideo, state, currentTime, setError, hasError, volume } =
    usePlayer(player);

  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumeSlider, setVolumeSlider] = useState(0);
  const [firstPlay, setFirstPlay] = useState(true);

  // Player volume change event
  useEffect(() => {
    setVolumeSlider(volume ?? 0);
  }, [volume]);

  // Player State Event
  useEffect(() => {
    if (firstPlay) {
      setIsPlaying(false);
      player?.pauseVideo();
      return;
    }
    if (state === PlayerStates.BUFFERING || state === PlayerStates.PLAYING) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [firstPlay, player, state]);

  // Sanity video id check event
  useEffect(() => {
    if (
      player &&
      currentSong?.video_id &&
      currentVideo !== currentSong?.video_id
    ) {
      player?.loadVideoById({
        videoId: currentSong.video_id,
        startSeconds: currentSong.start,
      });
      setError(false);
    }
  }, [
    player,
    currentVideo,
    currentSong?.video_id,
    currentSong?.start,
    setError,
  ]);

  // CurrentSong/repeat update event
  useEffect(() => {
    if (!player) return;
    if (currentSong) {
      player.loadVideoById({
        videoId: currentSong.video_id,
        startSeconds: currentSong.start,
      });
      setError(false);
    } else {
      player?.loadVideoById("");
      setProgress(0);
    }
  }, [player, currentSong, repeat, setError]);

  // CurrentTime Event
  useEffect(() => {
    if (
      currentTime === undefined ||
      currentSong === undefined ||
      currentSong.video_id !== currentVideo
    ) {
      return setProgress(0);
    }

    setProgress(
      ((currentTime - currentSong.start) * 100) /
        (currentSong.end - currentSong.start)
    );
  }, [currentSong, currentTime, currentVideo]);

  // End Progress Event
  useEffect(() => {
    if (!player || !currentSong || currentTime === undefined) return;
    if (currentSong.video_id !== currentVideo) {
      return;
    }
    // Prevent time from playing before start time
    if (currentTime < currentSong.start) {
      player.seekTo(currentSong.start, true);
      return;
    }
    // Proceeed to next song
    if (progress >= 100) {
      setProgress(0);
      next({ count: 1, userSkipped: false });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, isPlaying, currentSong, currentVideo, next, progress]);

  // Error Event Effect
  useEffect(() => {
    if (player && hasError && currentSong) {
      // Initialize retry count
      if (!retryCounts[currentSong.video_id])
        retryCounts[currentSong.video_id] = 0;

      // Allow up to 3 retries
      if (retryCounts[currentSong.video_id] <= 3) {
        if (getID(player.getVideoUrl()) !== currentSong.video_id) return;
        setTimeout(() => {
          console.log(
            `Retrying ${currentSong.name} - attempt #${
              retryCounts[currentSong.video_id] / 4
            }`
          );
          player?.loadVideoById({
            videoId: currentSong.video_id,
            startSeconds: currentSong.start,
          });
          setError(false);
        }, 2000);
        retryCounts[currentSong.video_id] += 1;
        return;
      }

      console.log(
        "SKIPPING____ DUE TO VIDEO PLAYBACK FAILURE (maybe the video is blocked in your country)"
      );
      toast({
        position: "top-right",
        status: "warning",
        title: `The Song: ${currentSong?.name} is not playable. Skipping it.`,
        duration: 10000,
      });
      next({ count: 1, userSkipped: false, hasError: true });
      setError(false);
    }
  }, [hasError, currentSong, toast, next, setError, player]);

  function onProgressChange(e: any) {
    if (!currentSong) return;
    setProgress(e);
    player?.seekTo(currentSong.start + (e / 100) * totalDuration, true);
  }

  const seconds = useMemo(() => {
    return formatSeconds((progress / 100) * totalDuration);
  }, [progress, totalDuration]);

  function togglePlay() {
    if (firstPlay) setFirstPlay(false);
    if (player) isPlaying ? player.pauseVideo() : player.playVideo();
    setIsPlaying((prev) => !prev);
  }
  return (
    <Fragment>
      <PlayerBar
        {...{
          progress,
          onProgressChange,
          currentSong,
          isPlaying,
          togglePlay,
          next,
          player,
          seconds,
          totalDuration,
          isExpanded,
          toggleExpanded,
          volume: volumeSlider,
          onVolumeChange: (e) => {
            player?.setVolume(e);
            setVolumeSlider(e);
          },
        }}
      />
      <PlayerOverlay isExpanded={isExpanded} close={toggleClose} />
    </Fragment>
  );
}
