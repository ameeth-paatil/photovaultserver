import 'package:flutter/material.dart';
import 'package:immich_mobile/extensions/build_context_extensions.dart';

class ImmichTitleText extends StatelessWidget {
  final double fontSize;
  final Color? color;

  const ImmichTitleText({
    super.key,
    this.fontSize = 48,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Image(
      image: AssetImage(
        context.isDarkTheme
            ? 'assets/pv-text-dark.png'
            : 'assets/pv-text-light.png',
      ),
      width: fontSize * 4,
      filterQuality: FilterQuality.high,
      color: context.primaryColor,
    );
  }
}
