import { privacyPolicy } from '@/app/privacyPolicy';
import { uiLanguage } from '@/i18n';
import { LibraryDialog } from './LibraryControls';
import { Capacitor } from '@capacitor/core';
import { androidPrivacyPolicy } from '@/app/androidPrivacyPolicy';

/** 隐私政策全文内置在 App 中：正式包禁止外部连接，离线也能查看。 */
export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const policy = (
    Capacitor.getPlatform() === 'android' ? androidPrivacyPolicy : privacyPolicy
  )[uiLanguage.value];
  return (
    <LibraryDialog title={policy.title} onClose={onClose}>
      <article class="privacy-policy">
        <p class="shelf-muted">{policy.effective}</p>
        <p>{policy.intro}</p>
        {policy.sections.map((section) => (
          <section key={section.title}>
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </LibraryDialog>
  );
}
