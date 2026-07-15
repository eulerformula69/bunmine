from backend.subtitles.jimaku_release import (
    episode_numbers_equal,
    infer_episode_number,
    release_info,
    release_tokens,
    score_candidate,
)


def test_release_tokens_detect_provider_source_and_codec():
    assert release_tokens("[EMBER] Show S01E03 1080p NF WEB-DL HEVC.ass") == [
        "EMBER",
        "Netflix",
        "WEB-DL",
        "1080p",
        "HEVC",
    ]


def test_release_info_has_stable_key_and_display_label():
    info = release_info("Show 03 DSNP WEBRip 1080p.srt")
    assert info["releaseKey"] == "dsnp|webrip|1080p"
    assert info["releaseLabel"] == "DSNP · WEBRip · 1080p"


def test_release_tokens_fall_back_to_entry_title():
    assert release_tokens("Show 03.srt", "Show Japanese Subtitles") == ["Show Japanese Subtitles"]


def test_episode_number_inference_supports_common_anime_names():
    assert infer_episode_number("Show.S02E12.1080p.ass") == 12.0
    assert infer_episode_number("Show - 06v2 [1080p].srt") == 6.0
    assert infer_episode_number("Show finale.srt") is None


def test_episode_number_comparison_is_numeric_and_tolerant():
    assert episode_numbers_equal("3", 3.0)
    assert not episode_numbers_equal(None, 3)
    assert not episode_numbers_equal("bad", 3)


def test_candidate_score_prefers_matching_release_and_srt():
    matching = score_candidate(
        {"filename": "Show 03 NF WEB-DL.srt", "extension": ".srt"},
        episode_number=3,
        video_filename="Show 03 Netflix WEB-DL.mkv",
    )
    unrelated = score_candidate(
        {"filename": "Show 03 DSNP.ass", "extension": ".ass"},
        episode_number=3,
        video_filename="Show 03 Netflix WEB-DL.mkv",
    )
    assert matching < unrelated
