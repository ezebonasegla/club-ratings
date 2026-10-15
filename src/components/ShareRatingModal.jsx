import React, { useRef, useState } from 'react';
import { X, Loader, Download, Copy, Check, Share2 } from 'lucide-react';
import './ShareRatingModal.css';

const hasValidRating = (p) =>
  p.rating !== null &&
  p.rating !== undefined &&
  p.rating !== 'N/A' &&
  !isNaN(p.rating);

const buildShareText = (rating, club) => {
  const ratedPlayers = rating.players.filter(hasValidRating);
  const avgRating = ratedPlayers.length > 0
    ? (ratedPlayers.reduce((sum, p) => sum + p.rating, 0) / ratedPlayers.length).toFixed(1)
    : 'N/A';

  let text = `⚽ ${club?.name || 'Mi Equipo'} - Valoraciones\n`;
  text += `🆚 ${rating.matchInfo.rival}\n`;
  text += `📊 ${rating.matchInfo.score} | ${rating.matchInfo.competition}\n`;
  text += `📅 ${rating.matchInfo.date}\n\n`;
  text += `📈 Promedio del equipo: ${avgRating}\n\n`;
  text += `👥 Valoraciones:\n`;

  [...ratedPlayers]
    .sort((a, b) => b.rating - a.rating)
    .forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐';
      text += `${medal} ${player.name}: ${player.rating}/10`;
      if (player.goals > 0) text += ` ⚽${player.goals}`;
      if (player.assists > 0) text += ` 🅰️${player.assists}`;
      text += `\n`;
    });

  return text;
};

const ShareRatingModal = ({ rating, club, onClose }) => {
  const shareCardRef = useRef(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [copied, setCopied] = useState(false);

  const ratedPlayers = rating.players
    .filter(hasValidRating)
    .sort((a, b) => b.rating - a.rating);
  const avgRating = ratedPlayers.length > 0
    ? (ratedPlayers.reduce((sum, p) => sum + p.rating, 0) / ratedPlayers.length).toFixed(1)
    : 'N/A';

  const fileName = `valoracion-${rating.matchInfo.rival.replace(/\s+/g, '-')}-${rating.matchInfo.date.replace(/\//g, '-')}.png`;

  const generateImageBlob = async () => {
    // html2canvas es pesado: se carga sólo cuando se necesita
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(shareCardRef.current, {
      backgroundColor: '#1a1a2e',
      scale: 2,
      logging: false,
      useCORS: true
    });
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const handleShareAsText = async () => {
    await navigator.clipboard.writeText(buildShareText(rating, club));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShareAsImage = async () => {
    if (!shareCardRef.current) return;
    setGeneratingImage(true);

    try {
      const blob = await generateImageBlob();
      const file = new File([blob], fileName, { type: 'image/png' });

      // En el celular: abrir el menú nativo de compartir (WhatsApp, Instagram, etc.)
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${club?.name || 'Mi Equipo'} vs ${rating.matchInfo.rival}`,
            text: buildShareText(rating, club)
          });
        } catch (error) {
          // El usuario cerró el menú de compartir: no es un error
          if (error.name !== 'AbortError') downloadBlob(blob);
        }
      } else {
        downloadBlob(blob);
      }
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error al generar la imagen');
    } finally {
      setGeneratingImage(false);
    }
  };

  const canShareNatively = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Compartir Valoración</h2>
          <button className="share-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={24} />
          </button>
        </div>

        {/* Preview Card */}
        <div className="share-preview" ref={shareCardRef}>
          <div className="share-card">
            <div className="share-card-header"
              style={{
                background: `linear-gradient(135deg, ${club?.colors.primary} 0%, ${club?.colors.secondary} 100%)`,
                color: club?.colors.text
              }}
            >
              <h3>{club?.name || 'Mi Equipo'}</h3>
              <p className="share-subtitle">Valoraciones</p>
            </div>

            <div className="share-card-body">
              <div className="share-match-info">
                <div className="share-rival">{rating.matchInfo.rival}</div>
                <div className="share-score">{rating.matchInfo.score}</div>
                <div className="share-details">
                  <span>{rating.matchInfo.date}</span>
                  <span>{rating.matchInfo.competition}</span>
                </div>
              </div>

              <div className="share-stats">
                <div className="share-stat">
                  <span className="stat-label">Promedio</span>
                  <span className="stat-value">{avgRating}</span>
                </div>
                <div className="share-stat">
                  <span className="stat-label">Jugadores</span>
                  <span className="stat-value">{ratedPlayers.length}</span>
                </div>
              </div>

              <div className="share-top-players">
                <h4>Valoraciones</h4>
                {ratedPlayers.map((player, index) => (
                  <div key={player.id} className="share-player-row">
                    <span className="player-rank">{index + 1}</span>
                    <span className="player-name-share">{player.name}</span>
                    <span className="player-rating-share">{player.rating}</span>
                  </div>
                ))}
              </div>

              <div className="share-footer">
                <span>Club Ratings App</span>
              </div>
            </div>
          </div>
        </div>

        <div className="share-actions">
          <button
            className="btn-share-option btn-share-text"
            onClick={handleShareAsText}
            disabled={generatingImage}
          >
            {copied ? (
              <>
                <Check size={20} />
                Copiado!
              </>
            ) : (
              <>
                <Copy size={20} />
                Copiar como Texto
              </>
            )}
          </button>
          <button
            className="btn-share-option btn-share-image"
            onClick={handleShareAsImage}
            disabled={generatingImage}
          >
            {generatingImage ? (
              <>
                <Loader size={20} className="share-spinner" />
                Generando...
              </>
            ) : canShareNatively ? (
              <>
                <Share2 size={20} />
                Compartir Imagen
              </>
            ) : (
              <>
                <Download size={20} />
                Descargar Imagen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareRatingModal;
