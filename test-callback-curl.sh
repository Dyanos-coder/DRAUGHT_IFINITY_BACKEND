#!/bin/bash

# Configuration
BACKEND_URL=${BACKEND_URL:-"http://localhost:5000"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:5173"}
CALLBACK_URL="${BACKEND_URL}/api/payments/moneroo/callback"

echo "🧪 Test des Callbacks Moneroo avec cURL"
echo "📋 Configuration:"
echo "   - Backend: $BACKEND_URL"
echo "   - Frontend: $FRONTEND_URL"
echo "   - Callback: $CALLBACK_URL"
echo ""

# Fonction pour tester un callback
test_callback() {
    local transaction_id=$1
    local status=$2
    local description=$3
    
    echo "🧪 Test: $description"
    echo "📤 URL: $CALLBACK_URL"
    echo "📋 Paramètres: transaction_id=$transaction_id, status=$status"
    
    # Test avec curl
    response=$(curl -s -w "%{http_code}|%{redirect_url}" \
        "$CALLBACK_URL?transaction_id=$transaction_id&status=$status&amount=1000&currency=XOF")
    
    # Extraire le code de statut et l'URL de redirection
    http_code=$(echo "$response" | cut -d'|' -f1)
    redirect_url=$(echo "$response" | cut -d'|' -f2)
    
    echo "✅ Réponse HTTP: $http_code"
    
    if [ "$http_code" = "302" ] || [ "$http_code" = "301" ]; then
        echo "🔄 Redirection: $redirect_url"
        
        if [[ "$redirect_url" == *"$FRONTEND_URL"* ]] && [[ "$redirect_url" == *"status="* ]]; then
            echo "✅ Redirection correcte vers le frontend"
        else
            echo "❌ Redirection incorrecte"
        fi
    else
        echo "⚠️ Pas de redirection détectée"
    fi
    
    echo "---"
    echo ""
}

# Tests
echo "🚀 Démarrage des tests..."
echo ""

# Test 1: Paiement réussi
test_callback "test_success_001" "success" "Paiement réussi"

# Test 2: Paiement échoué
test_callback "test_failed_002" "failed" "Paiement échoué"

# Test 3: Paiement en attente
test_callback "test_pending_003" "pending" "Paiement en attente"

# Test 4: Transaction ID manquant
echo "🧪 Test: Transaction ID manquant"
echo "📤 URL: $CALLBACK_URL"
echo "📋 Paramètres: status=success (sans transaction_id)"
response=$(curl -s -w "%{http_code}|%{redirect_url}" \
    "$CALLBACK_URL?status=success&amount=1000&currency=XOF")

http_code=$(echo "$response" | cut -d'|' -f1)
redirect_url=$(echo "$response" | cut -d'|' -f2)

echo "✅ Réponse HTTP: $http_code"

if [ "$http_code" = "302" ] || [ "$http_code" = "301" ]; then
    echo "🔄 Redirection: $redirect_url"
    
    if [[ "$redirect_url" == *"status=error"* ]] && [[ "$redirect_url" == *"Transaction ID manquant"* ]]; then
        echo "✅ Gestion d'erreur correcte"
    else
        echo "❌ Gestion d'erreur incorrecte"
    fi
fi

echo "---"
echo ""

echo "✅ Tests terminés"
echo ""
echo "📝 Instructions:"
echo "1. Assurez-vous que votre serveur backend est en cours d'exécution"
echo "2. Vérifiez les logs du backend pour voir le traitement des callbacks"
echo "3. Les redirections doivent pointer vers le frontend avec des paramètres de statut"
echo "4. Testez manuellement en visitant les URLs de redirection dans votre navigateur"
echo ""
echo "🔗 URLs de test manuel:"
echo "   - Succès: $FRONTEND_URL/wallet?status=success&message=Paiement traité avec succès"
echo "   - Échec: $FRONTEND_URL/wallet?status=failed&message=Paiement échoué"
echo "   - En attente: $FRONTEND_URL/wallet?status=pending&message=Paiement en attente"
echo "   - Erreur: $FRONTEND_URL/wallet?status=error&message=Transaction ID manquant" 