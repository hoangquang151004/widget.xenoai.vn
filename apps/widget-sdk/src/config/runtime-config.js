export function applyRemoteConfig(config, data) {
  if (!config || !data || typeof data !== 'object') return config;
  config.botName = data.name || config.botName;
  config.color = data.widget_color || config.color;
  config.placeholder = data.widget_placeholder || config.placeholder;
  config.position = data.widget_position || config.position;
  config.welcomeMessage = data.widget_welcome_message || config.welcomeMessage;
  config.avatarUrl = data.widget_avatar_url || config.avatarUrl;
  config.fontSize = data.widget_font_size || config.fontSize;
  config.showLogo = data.widget_show_logo !== undefined ? data.widget_show_logo : config.showLogo;
  config.salesEnabled = data.sales_enabled === true;
  config.fontFamily = data.font_family || config.fontFamily || 'sans';
  config.productLayout = data.product_layout || 'card';
  return config;
}
