// Safe, High-Performance Ad & Popup Blocker Rules (Zero False Positives)
module.exports = {
  // Specific known malicious ad networks & popup servers
  blockedDomains: [
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'propellerclick.com',
    'adsterra.com',
    'monetag.com',
    'exoclick.com',
    'clickadu.com',
    'hilltopads.com',
    'yllix.com',
    'juicyads.com',
    'trafficjunky.com',
    'trafficstars.com',
    'adcash.com',
    'bidvertiser.com',
    'popmyads.com',
    'infolinks.com',
    'vlitag.com',
    'pubmine.com',
    'mgid.com',
    'revcontent.com',
    'outbrain.com',
    'taboola.com',
    'criteo.com',
    'doubleclick.net',
    'googlesyndication.com',
    'adservice.google.com',
    'adnxs.com',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'smartadserver.com',
    'zeroredirect.com',
    'onclickalgo.com',
    'onclickperformance.com',
    'alwingulla.com',
    'deloton.com',
    'onclkds.com',
    'propu.sh',
    'inpagepush.com',
    'pushwelcome.com',
    'trackvoluum.com',
    'clksite.com',
    'adkeeper.co.uk',
    'tsyndicate.com',
    'tsyndicate.net',
    'bet365.com',
    '1xbet.com',
    'melbet.com',
    'mostbet.com',
    'linebet.com',
    'parimatch.com',
    'stake.com',
    'bc.game'
  ],

  // Specific URL keywords indicating ads (no short words like /ad/ that break real scripts)
  blockedUrlKeywords: [
    'popunder',
    'clickunder',
    'banner_ad',
    'ad_banner',
    'tracking.php?ad=',
    'redirect.php?url=http',
    'adsystem.php',
    'ad-provider',
    'adsterra',
    'propellerads',
    'exosrv'
  ],

  // Safe CSS injection: Targets ONLY confirmed ad elements, NEVER breaks player wrappers
  antiAdCss: `
    /* Cinema Shield: Safely hide confirmed ad banners & popunders */
    .popads, .popunder, .adsterra-banner, .propellerads,
    [class*="adsterra"], [id*="adsterra"], [class*="propellerads"],
    .adsbygoogle, .exo-native-widget,
    a[href*="bet365"], a[href*="1xbet"], a[href*="melbet"], a[href*="casino"],
    .ad-placement, .ad-banner, .advertisement, #ad-bottom, #ad-top {
      display: none !important;
      visibility: hidden !important;
      height: 0px !important;
      width: 0px !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `
};
